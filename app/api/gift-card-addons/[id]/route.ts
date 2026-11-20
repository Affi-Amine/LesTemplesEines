import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { GiftCardAddonSchema } from "@/lib/gift-card-addons"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager"])
    if ("response" in auth) return auth.response
    const { id } = await context.params
    const payload = GiftCardAddonSchema.partial().parse(await request.json())
    if (Object.keys(payload).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    const updates: Record<string, unknown> = { ...payload }
    if (payload.description !== undefined) updates.description = payload.description || null
    if (payload.image_url !== undefined) updates.image_url = payload.image_url || null
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("gift_card_addons").update(updates).eq("id", id).select("*").single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[gift-card-addons] PATCH error:", error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update gift card addon" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager"])
    if ("response" in auth) return auth.response
    const { id } = await context.params
    const supabase = createAdminClient()
    // Orders keep their snapshot (addon_id becomes NULL), so deleting the catalogue entry loses nothing.
    const { error } = await supabase.from("gift_card_addons").delete().eq("id", id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[gift-card-addons] DELETE error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete gift card addon" }, { status: 500 })
  }
}
