import type { createAdminClient } from "@/lib/supabase/admin"
import type { CashSheetSettings } from "@/lib/cash-sheet/types"

type SupabaseClient = ReturnType<typeof createAdminClient>

const MIGRATION_HINT = "(migration 2026-11-04_cash_sheets.sql appliquée ?)"

export const DEFAULT_SETTINGS: Omit<CashSheetSettings, "salon_id"> = {
  auto_enabled: false,
  send_time: "23:00",
  recipients: [],
  signer_name: "",
}

/** Settings for every active salon, defaults filled in for salons without a row. */
export async function listCashSheetSettings(supabase: SupabaseClient) {
  const [salons, rows] = await Promise.all([
    supabase.from("salons").select("id, name, city, email").eq("is_active", true).order("name"),
    supabase.from("cash_sheet_settings").select("salon_id, auto_enabled, send_time, recipients, signer_name, updated_at"),
  ])
  if (salons.error) throw new Error(salons.error.message)
  if (rows.error) throw new Error(`${rows.error.message} ${MIGRATION_HINT}`)
  const byId = new Map((rows.data || []).map((row) => [row.salon_id, row as CashSheetSettings]))
  return (salons.data || []).map((salon) => ({
    salon: { id: salon.id, name: salon.name.trim(), city: (salon.city || "").trim(), email: salon.email as string | null },
    settings: byId.get(salon.id) || { salon_id: salon.id, ...DEFAULT_SETTINGS },
  }))
}

export async function getCashSheetSettings(supabase: SupabaseClient, salonId: string): Promise<CashSheetSettings> {
  const { data, error } = await supabase
    .from("cash_sheet_settings")
    .select("salon_id, auto_enabled, send_time, recipients, signer_name, updated_at")
    .eq("salon_id", salonId)
    .maybeSingle()
  if (error) throw new Error(`${error.message} ${MIGRATION_HINT}`)
  return (data as CashSheetSettings) || { salon_id: salonId, ...DEFAULT_SETTINGS }
}

export async function saveCashSheetSettings(supabase: SupabaseClient, settings: CashSheetSettings) {
  const { error } = await supabase.from("cash_sheet_settings").upsert({
    salon_id: settings.salon_id,
    auto_enabled: settings.auto_enabled,
    send_time: settings.send_time,
    recipients: settings.recipients,
    signer_name: settings.signer_name,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`${error.message} ${MIGRATION_HINT}`)
}

/** Where a salon's sheet goes: configured recipients, else the salon's own address, else the admin address. */
export function resolveRecipients(settings: Pick<CashSheetSettings, "recipients">, salonEmail: string | null) {
  const configured = settings.recipients.map((r) => r.trim().toLowerCase()).filter(Boolean)
  if (configured.length) return [...new Set(configured)]
  const fallback = [salonEmail, ...(process.env.NOTIFICATIONS_ADMIN_EMAIL || "").split(",")].map((r) => (r || "").trim().toLowerCase()).filter(Boolean)
  return [...new Set(fallback)]
}
