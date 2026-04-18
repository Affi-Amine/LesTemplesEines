export const runtime = "nodejs"

import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/gift-cards"
import { eurosToCents, getInstallmentAmounts, PackPurchaseSchema } from "@/lib/packs"
import { getStripeClient } from "@/lib/stripe"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = PackPurchaseSchema.parse(body)
    const supabase = createAdminClient()

    const { data: pack, error: packError } = await supabase
      .from("packs")
      .select("*")
      .eq("id", payload.pack_id)
      .eq("is_active", true)
      .single()

    if (packError || !pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 })
    }

    if (!pack.allowed_installments.includes(payload.installment_count)) {
      return NextResponse.json({ error: "Installment option not allowed for this pack" }, { status: 400 })
    }

    const stripe = getStripeClient()
    const baseUrl = getBaseUrl(request.nextUrl.origin)
    const amountCents = eurosToCents(Number(pack.price))
    const installmentAmounts = getInstallmentAmounts(amountCents, payload.installment_count)

    const session =
      payload.installment_count === 1
        ? await stripe.checkout.sessions.create({
            mode: "payment",
            success_url: `${baseUrl}/forfaits?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/forfaits?checkout=cancel`,
            customer_email: payload.customer_email,
            metadata: {
              type: "pack",
              pack_id: pack.id,
              installment_count: String(payload.installment_count),
              customer_email: payload.customer_email,
              customer_name: payload.customer_name,
            },
            line_items: [{
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: amountCents,
                product_data: {
                  name: pack.name,
                  description: `${pack.number_of_sessions} séances`,
                },
              },
            }],
          })
        : await stripe.checkout.sessions.create({
            mode: "subscription",
            success_url: `${baseUrl}/forfaits?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/forfaits?checkout=cancel`,
            customer_email: payload.customer_email,
            metadata: {
              type: "pack",
              pack_id: pack.id,
              installment_count: String(payload.installment_count),
              customer_email: payload.customer_email,
              customer_name: payload.customer_name,
            },
            line_items: [{
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: installmentAmounts[0],
                recurring: {
                  interval: "month",
                  interval_count: 1,
                },
                product_data: {
                  name: pack.name,
                  description: `Paiement fractionné sur ${payload.installment_count} échéances`,
                },
              },
            }],
          })

    const { error: insertError } = await supabase
      .from("stripe_checkout_sessions")
      .insert([{
        checkout_type: "pack",
        stripe_checkout_session_id: session.id,
        status: "open",
        amount_cents: amountCents,
        currency: "eur",
        payload: {
          pack_id: pack.id,
          installment_count: payload.installment_count,
          installment_amounts: installmentAmounts,
          customer_email: payload.customer_email,
          customer_name: payload.customer_name,
        },
      }])

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      session_id: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error("[packs] Purchase error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to purchase pack" }, { status: 500 })
  }
}
