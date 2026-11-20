import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth, getStaffAuth } from "@/lib/auth/api-auth"
import { GiftCardAddonSchema } from "@/lib/gift-card-addons"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Physical extras offered with a gift card. The gift page reads the active
// ones; the back office (admin, manager) manages the whole catalogue.

export async function GET(request: NextRequest) {
  try {
    const wantsAll = request.nextUrl.searchParams.get("all") === "1" && Boolean(getStaffAuth(request))
    const supabase = createAdminClient()
    let query = supabase.from("gift_card_addons").select("*").order("sort_order").order("created_at")
    if (!wantsAll) query = query.eq("is_active", true)
    const { data, error } = await query
    if (error) {
      // Before the migration runs there is simply nothing to offer.
      if (/gift_card_addons/.test(error.message)) return NextResponse.json([])
      throw error
    }
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[gift-card-addons] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch gift card addons" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager"])
    if ("response" in auth) return auth.response
    const payload = GiftCardAddonSchema.parse(await request.json())
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("gift_card_addons")
      .insert([{ ...payload, description: payload.description || null, image_url: payload.image_url || null }])
      .select("*")
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[gift-card-addons] POST error:", error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create gift card addon" }, { status: 500 })
  }
}
