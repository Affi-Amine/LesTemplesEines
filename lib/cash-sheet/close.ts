import { formatInTimeZone } from "date-fns-tz"

import { buildCashSheet, TIMEZONE } from "@/lib/cash-sheet/build"
import { cashSheetFilename, euros, renderCashSheetPdf } from "@/lib/cash-sheet/pdf"
import { getCashSheetSettings, resolveRecipients } from "@/lib/cash-sheet/settings"
import { activityRecap, sumAmounts, type CashSheet, type CashSheetClosure } from "@/lib/cash-sheet/types"
import { escapeEmailHtml } from "@/lib/email/html"
import { isEmailEnabled, sendEmail } from "@/lib/email/resend"
import type { createAdminClient } from "@/lib/supabase/admin"

type SupabaseClient = ReturnType<typeof createAdminClient>

const CLOSURE_COLUMNS = "id, salon_id, sheet_date, reference, signer_name, closed_at, closed_by, sent_to, sent_at"

export async function getClosure(supabase: SupabaseClient, salonId: string, date: string) {
  const { data, error } = await supabase
    .from("cash_sheet_closures")
    .select(`${CLOSURE_COLUMNS}, sheet`)
    .eq("salon_id", salonId)
    .eq("sheet_date", date)
    .maybeSingle()
  if (error) throw new Error(`${error.message} (migration 2026-11-04_cash_sheets.sql appliquée ?)`)
  if (!data) return null
  const { sheet, ...closure } = data
  return { closure: closure as CashSheetClosure, sheet: sheet as CashSheet }
}

/** The sheet as it should be shown now: the frozen copy once closed, a live preview before. */
export async function loadCashSheet(supabase: SupabaseClient, salonId: string, date: string) {
  const closed = await getClosure(supabase, salonId, date)
  if (closed) return closed
  const settings = await getCashSheetSettings(supabase, salonId)
  return { closure: null, sheet: await buildCashSheet(supabase, salonId, date, settings.signer_name) }
}

/**
 * Freezes the day. Refuses when a closure already exists: the sheet says its
 * numbers can no longer change, so the only way to redo one is to delete the
 * closure row by hand.
 */
export async function closeCashSheet(supabase: SupabaseClient, input: { salonId: string; date: string; signerName: string; closedBy: string; send: boolean }) {
  const existing = await getClosure(supabase, input.salonId, input.date)
  if (existing) throw new Error(`Cette journée est déjà clôturée (${existing.closure.reference}, le ${formatInTimeZone(new Date(existing.closure.closed_at), TIMEZONE, "dd/MM/yyyy 'à' HH:mm")}).`)

  const built = await buildCashSheet(supabase, input.salonId, input.date, input.signerName)
  const sheet: CashSheet = { ...built, signerName: input.signerName, closedAt: new Date().toISOString() }
  const { data, error } = await supabase
    .from("cash_sheet_closures")
    .insert({ salon_id: input.salonId, sheet_date: input.date, reference: sheet.reference, signer_name: input.signerName, closed_at: sheet.closedAt, closed_by: input.closedBy, sheet })
    .select(CLOSURE_COLUMNS)
    .single()
  if (error || !data) throw new Error(error?.message || "Clôture non enregistrée")
  let closure = data as CashSheetClosure

  let sent: { to: string[] } | { skipped: string } = { skipped: "non demandé" }
  if (input.send) {
    try {
      sent = await sendCashSheet(supabase, closure, sheet)
      if ("to" in sent) closure = { ...closure, sent_to: sent.to, sent_at: new Date().toISOString() }
    } catch (mailError) {
      // The closure stands; the sheet can be sent again from the page.
      sent = { skipped: mailError instanceof Error ? mailError.message : "envoi impossible" }
    }
  }
  return { closure, sheet, sent }
}

/** Emails the PDF of a closed sheet to the salon's recipients and records it. */
export async function sendCashSheet(supabase: SupabaseClient, closure: CashSheetClosure, sheet: CashSheet) {
  const settings = await getCashSheetSettings(supabase, closure.salon_id)
  const to = resolveRecipients(settings, sheet.salon.email)
  if (!to.length) throw new Error("Aucun destinataire : renseignez les destinataires dans les paramètres ou l'e-mail du salon.")
  if (!isEmailEnabled) throw new Error("Envoi d'e-mails désactivé sur ce déploiement (RESEND_API_KEY manquant).")

  const pdf = await renderCashSheetPdf(sheet)
  const total = euros(sumAmounts(sheet.totals))
  const cash = euros(sheet.totals.card + sheet.totals.cash)
  const day = formatInTimeZone(new Date(`${sheet.date}T12:00:00Z`), "UTC", "dd/MM/yyyy")
  await sendEmail({
    to,
    subject: `Feuille de caisse ${day} – ${sheet.salon.name}`,
    html: `
      <p>Bonjour,</p>
      <p>Ci-joint la feuille de caisse du <strong>${day}</strong> pour <strong>${escapeEmailHtml(sheet.salon.name)}</strong> (référence ${escapeEmailHtml(sheet.reference)}).</p>
      <ul>
        <li>Total caisse (CB + espèces) : <strong>${cash} €</strong></li>
        <li>Total général : <strong>${total} €</strong></li>
        <li>Lignes enregistrées : ${sheet.counts.lines} · absences : ${sheet.counts.noShows} · non réglées : ${sheet.counts.unpaid}</li>
        ${activityRecap(sheet).map(([label, value]) => `<li>${escapeEmailHtml(label)} : ${escapeEmailHtml(value)}</li>`).join("")}
      </ul>
      <p>Responsable : ${escapeEmailHtml(sheet.signerName || "—")}. Clôturée le ${escapeEmailHtml(formatInTimeZone(new Date(sheet.closedAt || closure.closed_at), TIMEZONE, "dd/MM/yyyy 'à' HH:mm"))}.</p>
    `,
    attachments: [{ filename: cashSheetFilename(sheet), content: pdf, contentType: "application/pdf" }],
  })
  await supabase.from("cash_sheet_closures").update({ sent_to: to, sent_at: new Date().toISOString() }).eq("id", closure.id)
  return { to }
}

/**
 * Scheduled closing. Each salon with automatic closing on gets its sheet
 * closed and sent once the configured Paris time has passed, once per day.
 * A send time before 05:00 closes the previous day (salons closing after
 * midnight). A missed slot is caught up by the next run of the same day.
 */
export async function runScheduledClosures(supabase: SupabaseClient, now = new Date()) {
  const { data: rows, error } = await supabase.from("cash_sheet_settings").select("salon_id, auto_enabled, send_time, recipients, signer_name").eq("auto_enabled", true)
  if (error) throw new Error(`${error.message} (migration 2026-11-04_cash_sheets.sql appliquée ?)`)
  const today = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd")
  const yesterday = formatInTimeZone(new Date(now.getTime() - 86_400_000), TIMEZONE, "yyyy-MM-dd")
  const nowTime = formatInTimeZone(now, TIMEZONE, "HH:mm")
  const results: { salonId: string; date: string; outcome: string }[] = []

  for (const row of rows || []) {
    if (nowTime < row.send_time) continue
    const date = row.send_time < "05:00" ? yesterday : today
    if (await getClosure(supabase, row.salon_id, date)) continue
    try {
      const { closure, sent } = await closeCashSheet(supabase, { salonId: row.salon_id, date, signerName: row.signer_name, closedBy: "auto", send: true })
      results.push({ salonId: row.salon_id, date, outcome: "to" in sent ? `clôturée ${closure.reference}, envoyée à ${sent.to.join(", ")}` : `clôturée ${closure.reference}, non envoyée : ${sent.skipped}` })
    } catch (closeError) {
      results.push({ salonId: row.salon_id, date, outcome: `échec : ${closeError instanceof Error ? closeError.message : String(closeError)}` })
    }
  }
  return results
}
