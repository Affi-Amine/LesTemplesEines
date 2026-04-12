export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id")
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: checkoutSession, error } = await supabase
      .from("stripe_checkout_sessions")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle()

    if (error) throw error
    if (!checkoutSession) {
      return NextResponse.json({ error: "Checkout session not found" }, { status: 404 })
    }

    let appointment = null
    let giftCard = null

    if (checkoutSession.appointment_id) {
      const { data } = await supabase
        .from("appointments")
        .select(`
          *,
          client:clients(*),
          staff:staff(id, first_name, last_name, role, phone),
          assignments:appointment_assignments(
            staff:staff(id, first_name, last_name)
          ),
          service:services(*),
          salon:salons(id, name, city, address)
        `)
        .eq("id", checkoutSession.appointment_id)
        .maybeSingle()
      appointment = data || null
    }

    if (checkoutSession.gift_card_id) {
      const { data } = await supabase
        .from("gift_cards")
        .select(`
          *,
          service:services(
            id,
            name,
            duration_minutes,
            price_cents
          )
        `)
        .eq("id", checkoutSession.gift_card_id)
        .maybeSingle()
      giftCard = data || null
    }

    return NextResponse.json({
      session_id: checkoutSession.stripe_checkout_session_id,
      checkout_type: checkoutSession.checkout_type,
      status: checkoutSession.status,
      appointment,
      gift_card: giftCard,
    })
  } catch (error) {
    console.error("[stripe] Checkout status error:", error)
    return NextResponse.json({ error: "Failed to fetch checkout status" }, { status: 500 })
  }
}
