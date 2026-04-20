export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const requestId = crypto.randomUUID()
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id")
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }
    console.log("[stripe] checkout-status start", { requestId, sessionId })

    const supabase = createAdminClient()
    const sessionLookupStartedAt = Date.now()
    const { data: checkoutSession, error } = await supabase
      .from("stripe_checkout_sessions")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle()
    console.log("[stripe] checkout-status session lookup", {
      requestId,
      sessionId,
      durationMs: Date.now() - sessionLookupStartedAt,
    })

    if (error) throw error
    if (!checkoutSession) {
      return NextResponse.json({ error: "Checkout session not found" }, { status: 404 })
    }

    let appointment = null
    let giftCard = null
    let clientPack = null
    let service = null
    let pack = null

    if (checkoutSession.appointment_id) {
      const appointmentLookupStartedAt = Date.now()
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
      console.log("[stripe] checkout-status appointment lookup", {
        requestId,
        appointmentId: checkoutSession.appointment_id,
        durationMs: Date.now() - appointmentLookupStartedAt,
      })
    }

    if (checkoutSession.gift_card_id) {
      const giftCardLookupStartedAt = Date.now()
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
      console.log("[stripe] checkout-status gift-card lookup", {
        requestId,
        giftCardId: checkoutSession.gift_card_id,
        durationMs: Date.now() - giftCardLookupStartedAt,
      })
    }

    if (checkoutSession.client_pack_id) {
      const clientPackLookupStartedAt = Date.now()
      const { data } = await supabase
        .from("client_packs")
        .select(`
          *,
          pack:packs(*)
        `)
        .eq("id", checkoutSession.client_pack_id)
        .maybeSingle()

      clientPack = data || null
      pack = data?.pack || null
      console.log("[stripe] checkout-status client-pack lookup", {
        requestId,
        clientPackId: checkoutSession.client_pack_id,
        durationMs: Date.now() - clientPackLookupStartedAt,
      })
    }

    if (!clientPack && checkoutSession.checkout_type === "pack") {
      const fallbackPackLookupStartedAt = Date.now()
      const { data } = await supabase
        .from("client_packs")
        .select(`
          *,
          pack:packs(*)
        `)
        .eq("stripe_checkout_session_id", checkoutSession.stripe_checkout_session_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      clientPack = data || null
      pack = data?.pack || pack
      console.log("[stripe] checkout-status fallback client-pack lookup", {
        requestId,
        durationMs: Date.now() - fallbackPackLookupStartedAt,
      })
    }

    const payload = checkoutSession.payload && typeof checkoutSession.payload === "object"
      ? checkoutSession.payload
      : null

    const payloadServiceId = typeof payload?.service_id === "string" ? payload.service_id : null
    const payloadPackId = typeof payload?.pack_id === "string" ? payload.pack_id : null

    if (payloadServiceId) {
      const serviceLookupStartedAt = Date.now()
      const { data } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents")
        .eq("id", payloadServiceId)
        .maybeSingle()

      service = data || null
      console.log("[stripe] checkout-status payload service lookup", {
        requestId,
        serviceId: payloadServiceId,
        durationMs: Date.now() - serviceLookupStartedAt,
      })
    }

    if (!pack && payloadPackId) {
      const packLookupStartedAt = Date.now()
      const { data } = await supabase
        .from("packs")
        .select("*")
        .eq("id", payloadPackId)
        .maybeSingle()

      pack = data || null
      console.log("[stripe] checkout-status payload pack lookup", {
        requestId,
        packId: payloadPackId,
        durationMs: Date.now() - packLookupStartedAt,
      })
    }

    const resolvedStatus =
      checkoutSession.checkout_type === "pack" && clientPack
        ? "completed"
        : checkoutSession.status

    console.log("[stripe] checkout-status success", {
      requestId,
      sessionId,
      status: resolvedStatus,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      session_id: checkoutSession.stripe_checkout_session_id,
      checkout_type: checkoutSession.checkout_type,
      status: resolvedStatus,
      amount_cents: checkoutSession.amount_cents,
      currency: checkoutSession.currency,
      payload: payload ? {
        buyer_email: typeof payload.buyer_email === "string" ? payload.buyer_email : null,
        recipient_email: typeof payload.recipient_email === "string" ? payload.recipient_email : null,
        recipient_name: typeof payload.recipient_name === "string" ? payload.recipient_name : null,
        personal_message: typeof payload.personal_message === "string" ? payload.personal_message : null,
        service_id: payloadServiceId,
        pack_id: payloadPackId,
        customer_email: typeof payload?.customer_email === "string" ? payload.customer_email : null,
        customer_name: typeof payload?.customer_name === "string" ? payload.customer_name : null,
      } : null,
      service,
      pack,
      appointment,
      gift_card: giftCard,
      client_pack: clientPack,
    })
  } catch (error) {
    console.error("[stripe] Checkout status error:", {
      requestId,
      durationMs: Date.now() - startedAt,
      error,
    })
    return NextResponse.json({ error: "Failed to fetch checkout status" }, { status: 500 })
  }
}
