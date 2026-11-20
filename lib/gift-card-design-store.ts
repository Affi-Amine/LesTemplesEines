import type { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_GIFT_CARD_DESIGN, resolveGiftCardDesign, type GiftCardDesign } from "@/lib/gift-card-design"

type SupabaseClient = ReturnType<typeof createAdminClient>

let warnedMissingTable = false

/** The salons' design, or the defaults while the migration is not applied yet. */
export async function loadGiftCardDesign(supabase: SupabaseClient): Promise<GiftCardDesign> {
  const { data, error } = await supabase.from("gift_card_design_settings").select("*").eq("id", 1).maybeSingle()
  if (error) {
    if (!warnedMissingTable) {
      warnedMissingTable = true
      console.warn("[gift-cards] Design settings unavailable, using defaults (migration 2026-11-20_gift_card_addons_and_design.sql applied?):", error.message)
    }
    return DEFAULT_GIFT_CARD_DESIGN
  }
  return resolveGiftCardDesign(data)
}

export async function saveGiftCardDesign(supabase: SupabaseClient, design: GiftCardDesign, staffId: string | null) {
  const { data, error } = await supabase
    .from("gift_card_design_settings")
    .upsert({ id: 1, ...design, updated_by_staff_id: staffId, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return resolveGiftCardDesign(data)
}
