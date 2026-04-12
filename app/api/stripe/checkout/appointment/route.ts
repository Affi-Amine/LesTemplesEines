export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { BookableAppointmentSchema, validateBookableAppointment } from "@/lib/appointments/create"
import { getStripeClient } from "@/lib/stripe"
import { getBaseUrl } from "@/lib/gift-cards"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = BookableAppointmentSchema.parse(body)
    const supabase = createAdminClient()
    const { service } = await validateBookableAppointment(supabase, payload)
    const stripe = getStripeClient()
    const baseUrl = getBaseUrl()

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/booking-success?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/booking-success?checkout=cancel`,
      customer_email: payload.client_data?.email,
      metadata: {
        type: "appointment",
        service_id: payload.service_id,
        salon_id: payload.salon_id,
        appointment_id: "",
      },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: service.price_cents,
          product_data: {
            name: service.name,
            description: `${service.duration_minutes} min`,
          },
        },
      }],
    })

    const { error: insertError } = await supabase
      .from("stripe_checkout_sessions")
      .insert([{
        checkout_type: "appointment",
        stripe_checkout_session_id: session.id,
        status: "open",
        amount_cents: service.price_cents,
        currency: "eur",
        payload,
      }])

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({
      session_id: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error("[stripe] Appointment checkout error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create checkout session" }, { status: 500 })
  }
}
