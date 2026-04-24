export const runtime = "nodejs"

import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/gift-cards"
import { getStripeClient } from "@/lib/stripe"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const PurchaseGiftCardSchema = z.object({
  service_id: z.string().uuid(),
  buyer_name: z.string().trim().min(1),
  buyer_email: z.string().email(),
  recipient_email: z.string().email().optional().or(z.literal("")),
  recipient_name: z.string().trim().optional(),
  personal_message: z.string().trim().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = PurchaseGiftCardSchema.parse(body)
    const supabase = createAdminClient()

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select(`
        *,
        service_salons!left(
          salon_id,
          salon:salons(id, name, slug, city)
        )
      `)
      .eq("id", payload.service_id)
      .eq("is_active", true)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    const stripe = getStripeClient()
    const baseUrl = getBaseUrl(request.nextUrl.origin)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/gift/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/gift?checkout=cancel`,
      customer_email: payload.buyer_email,
      metadata: {
        type: "gift_card",
        service_id: service.id,
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
        checkout_type: "gift_card",
        stripe_checkout_session_id: session.id,
        status: "open",
        amount_cents: service.price_cents,
        currency: "eur",
        payload: {
          service_id: service.id,
          buyer_name: payload.buyer_name,
          buyer_email: payload.buyer_email,
          recipient_email: payload.recipient_email || undefined,
          recipient_name: payload.recipient_name || undefined,
          personal_message: payload.personal_message || undefined,
        },
      }])

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      session_id: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error("[gift-card] Purchase error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to purchase gift card" }, { status: 500 })
  }
}
