import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

const ORDER_SELECT = `
  *,
  gift_card:gift_cards(
    id, code, buyer_name, buyer_email, recipient_name, amount_cents, purchased_at,
    service:services(id, name)
  )
`

/** The physical extras bought with gift cards, newest first; `status` narrows the list. */
export async function GET(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
    if ("response" in auth) return auth.response
    const status = request.nextUrl.searchParams.get("status")
    const supabase = createAdminClient()
    let query = supabase.from("gift_card_addon_orders").select(ORDER_SELECT).order("created_at", { ascending: false })
    if (status && status !== "all") query = query.eq("status", status)
    const { data, error } = await query
    if (error) {
      if (/gift_card_addon_orders/.test(error.message)) return NextResponse.json([])
      throw error
    }
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[gift-card-addon-orders] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch gift card addon orders" }, { status: 500 })
  }
}
