import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

import type { createAdminClient } from "@/lib/supabase/admin"
import { EMPTY_AMOUNTS, type CashSheet, type SheetAmounts, type SheetLine, type VoucherKind } from "@/lib/cash-sheet/types"

export const TIMEZONE = "Europe/Paris"

type SupabaseClient = ReturnType<typeof createAdminClient>

/** What the aggregation needs from one appointment; `buildCashSheet` fills it from the database. */
export interface SheetAppointmentInput {
  id: string
  start_time: string
  end_time: string
  status: string
  payment_status: string | null
  payment_method: string | null
  amount_paid_cents: number | null
  service_items: { name: string; price_cents: number }[] | null
  client: { first_name: string | null; last_name: string | null } | null
  service: { name: string; price_cents: number } | null
  staff: { first_name: string | null; last_name: string | null }[]
  payments: { amount_cents: number; method: string }[]
}

export interface SheetSalonInput {
  id: string
  name: string
  slug: string | null
  address: string | null
  city: string | null
  email: string | null
}

/** Statuses that belong on the sheet. Blocks, cancellations and unconfirmed requests do not. */
const SHEET_STATUSES = ["confirmed", "in_progress", "completed", "no_show"]

function column(method: string | null | undefined): keyof SheetAmounts | null {
  switch (method) {
    case "card": return "card"
    case "cash": return "cash"
    case "treatwell": return "treatwell"
    case "stripe": return "online"
    case "check":
    case "other":
    case "on_site":
    case "mixed":
      return "other"
    default:
      return null
  }
}

function voucher(method: string | null | undefined): VoucherKind | null {
  if (method === "gift_card") return "gift_card"
  if (method === "pack") return "pack"
  if (method === "loyalty") return "stamp"
  return null
}

/** The sheet's own duration notation: hours, a dot, then minutes ("1.30" is 1 h 30). */
export function durationLabel(start: string, end: string) {
  const minutes = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60_000))
  return `${Math.floor(minutes / 60)}.${String(minutes % 60).padStart(2, "0")}`
}

/** "FC-20261101-NUAD": date plus the salon's short name, so six salons never share a reference. */
export function sheetReference(salon: Pick<SheetSalonInput, "name" | "slug">, date: string) {
  const words = (salon.slug || salon.name).replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter((w) => !/^(le|la|les|temple|du|de)$/i.test(w))
  const code = (words.at(-1) || salon.name).normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "SALON"
  return `FC-${date.replace(/-/g, "")}-${code}`
}

function priceOf(appointment: SheetAppointmentInput) {
  if (appointment.service_items?.length) return appointment.service_items.reduce((sum, item) => sum + (item.price_cents || 0), 0)
  return appointment.service?.price_cents || 0
}

function clientLabel(client: SheetAppointmentInput["client"]) {
  const name = client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : ""
  return name || "Passage"
}

function staffLabel(staff: SheetAppointmentInput["staff"]) {
  // Staff records are "Madame <name>"; the agenda shows the last name.
  return staff
    .map((s) => (s.last_name || "").trim() || (s.first_name || "").trim())
    .filter(Boolean)
    .join(", ")
}

/** Pure: turns a day's appointments into the sheet. Tested without a database in scripts/test-cash-sheet.cjs. */
export function aggregateCashSheet(input: {
  salon: SheetSalonInput
  date: string
  appointments: SheetAppointmentInput[]
  signerName?: string
  now?: Date
}): CashSheet {
  const lines: SheetLine[] = []
  const totals: SheetAmounts = { ...EMPTY_AMOUNTS }
  const counts = { lines: 0, giftCards: 0, packs: 0, stamps: 0, noShows: 0, unpaid: 0 }
  let noShowAmountCents = 0
  let unpaidAmountCents = 0

  const sorted = [...input.appointments]
    .filter((a) => SHEET_STATUSES.includes(a.status))
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))

  for (const appointment of sorted) {
    const amounts: SheetAmounts = { ...EMPTY_AMOUNTS }
    const vouchers = new Set<VoucherKind>()
    const priceCents = priceOf(appointment)
    let status: SheetLine["status"] = "paid"

    if (appointment.status === "no_show") {
      status = "no_show"
      noShowAmountCents += priceCents
    } else if (appointment.payments.length) {
      // Recorded payments are the source of truth: a mixed payment is one row per method.
      for (const payment of appointment.payments) {
        const key = column(payment.method)
        if (key) amounts[key] += payment.amount_cents
        const kind = voucher(payment.method)
        if (kind) vouchers.add(kind)
      }
      if (!appointment.payments.some((p) => column(p.method)) && !vouchers.size) status = "unpaid"
    } else if (appointment.payment_status === "paid" || appointment.payment_status === "partial") {
      const kind = voucher(appointment.payment_method)
      if (kind) vouchers.add(kind)
      else {
        const key = column(appointment.payment_method) || "other"
        amounts[key] += appointment.amount_paid_cents || priceCents
      }
    } else {
      status = "unpaid"
    }

    if (status === "unpaid") {
      counts.unpaid += 1
      unpaidAmountCents += priceCents
    }
    for (const key of Object.keys(totals) as (keyof SheetAmounts)[]) totals[key] += amounts[key]
    if (vouchers.has("gift_card")) counts.giftCards += 1
    if (vouchers.has("pack")) counts.packs += 1
    if (vouchers.has("stamp")) counts.stamps += 1
    if (status === "no_show") counts.noShows += 1
    counts.lines += 1

    lines.push({
      appointmentId: appointment.id,
      time: formatInTimeZone(new Date(appointment.start_time), TIMEZONE, "HH:mm"),
      client: clientLabel(appointment.client),
      service: appointment.service_items?.length ? appointment.service_items.map((s) => s.name).join(" + ") : appointment.service?.name || "Prestation",
      amounts,
      vouchers: [...vouchers],
      staff: staffLabel(appointment.staff),
      duration: durationLabel(appointment.start_time, appointment.end_time),
      status,
      priceCents,
    })
  }

  return {
    salon: {
      id: input.salon.id,
      name: input.salon.name.trim(),
      address: (input.salon.address || "").trim(),
      city: (input.salon.city || "").trim(),
      email: input.salon.email,
    },
    date: input.date,
    reference: sheetReference(input.salon, input.date),
    signerName: input.signerName || "",
    closedAt: null,
    generatedAt: (input.now || new Date()).toISOString(),
    lines,
    totals,
    counts,
    noShowAmountCents,
    unpaidAmountCents,
  }
}

/** Reads one salon's day from the database and aggregates it. */
export async function buildCashSheet(supabase: SupabaseClient, salonId: string, date: string, signerName?: string): Promise<CashSheet> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date invalide")
  const { data: salon, error: salonError } = await supabase.from("salons").select("id, name, slug, address, city, email").eq("id", salonId).maybeSingle()
  if (salonError) throw new Error(salonError.message)
  if (!salon) throw new Error("Salon introuvable")

  const from = fromZonedTime(`${date}T00:00:00`, TIMEZONE).toISOString()
  const to = fromZonedTime(`${date}T23:59:59.999`, TIMEZONE).toISOString()
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id, start_time, end_time, status, payment_status, payment_method, amount_paid_cents, service_items, staff_id,
      client:clients(first_name, last_name),
      service:services(name, price_cents),
      staff:staff!staff_id(first_name, last_name),
      assignments:appointment_assignments(staff:staff(first_name, last_name)),
      payments(amount_cents, method)
    `)
    .eq("salon_id", salonId)
    .gte("start_time", from)
    .lte("start_time", to)
    .in("status", SHEET_STATUSES)
  if (error) throw new Error(error.message)

  /* eslint-disable @typescript-eslint/no-explicit-any -- Supabase embeds come back untyped */
  const one = (value: any) => (Array.isArray(value) ? value[0] ?? null : value ?? null)
  const appointments: SheetAppointmentInput[] = (data || []).map((row: any) => {
    const primary = one(row.staff)
    const extra = (row.assignments || []).map((a: any) => one(a.staff)).filter(Boolean)
    const seen = new Set<string>()
    const staff = [primary, ...extra].filter(Boolean).filter((s: any) => {
      const key = `${s.first_name}|${s.last_name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return {
      id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      payment_status: row.payment_status,
      payment_method: row.payment_method,
      amount_paid_cents: row.amount_paid_cents,
      service_items: row.service_items,
      client: one(row.client),
      service: one(row.service),
      staff,
      payments: row.payments || [],
    }
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return aggregateCashSheet({ salon, date, appointments, signerName })
}
