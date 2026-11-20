import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { GIFT_CARD_THEMES, GiftCardDesignSchema } from "@/lib/gift-card-design"
import { loadGiftCardDesign, saveGiftCardDesign } from "@/lib/gift-card-design-store"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

/** The gift card design the salons chose, with the available themes. */
export async function GET(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
  if ("response" in auth) return auth.response
  const design = await loadGiftCardDesign(createAdminClient())
  return NextResponse.json({
    design,
    themes: Object.entries(GIFT_CARD_THEMES).map(([key, theme]) => ({ key, label: theme.label, colors: theme.background, accent: theme.accent })),
  })
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager"])
    if ("response" in auth) return auth.response
    const design = GiftCardDesignSchema.parse(await request.json())
    const saved = await saveGiftCardDesign(createAdminClient(), design, auth.payload.staffId || null)
    return NextResponse.json({ design: saved })
  } catch (error) {
    console.error("[gift-cards] design PUT error:", error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    const message = error instanceof Error ? error.message : "Failed to save design"
    const missingTable = /gift_card_design_settings/.test(message)
    return NextResponse.json({ error: missingTable ? "La table des réglages n'existe pas encore : appliquez la migration 2026-11-20_gift_card_addons_and_design.sql dans Supabase." : message }, { status: missingTable ? 503 : 500 })
  }
}
