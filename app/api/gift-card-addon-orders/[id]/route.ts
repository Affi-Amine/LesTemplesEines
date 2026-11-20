import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { ADDON_ORDER_STATUSES } from "@/lib/gift-card-addons"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateSchema = z.object({
  status: z.enum(ADDON_ORDER_STATUSES).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
    if ("response" in auth) return auth.response
    const { id } = await context.params
    const payload = UpdateSchema.parse(await request.json())
    const updates: Record<string, unknown> = {}
    if (payload.status) {
      updates.status = payload.status
      if (payload.status === "expedie") updates.shipped_at = new Date().toISOString()
    }
    if (payload.notes !== undefined) updates.notes = payload.notes || null
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("gift_card_addon_orders").update(updates).eq("id", id).select("*").single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[gift-card-addon-orders] PATCH error:", error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update order" }, { status: 500 })
  }
}
