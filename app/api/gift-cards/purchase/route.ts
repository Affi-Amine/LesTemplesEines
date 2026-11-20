export const runtime = "nodejs"

import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl, GIFT_CARD_INELIGIBLE_MESSAGE, isGiftCardEligible } from "@/lib/gift-cards"
import { AddonSelectionSchema, buildGiftCardLineItems, priceGiftCardOrder, validateAddonSelection } from "@/lib/gift-card-addons"
import { getStripeClient, isStripeEnabled } from "@/lib/stripe"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const PurchaseGiftCardSchema = z.object({
  service_id: z.string().uuid(),
  buyer_name: z.string().trim().min(1),
  buyer_email: z.string().email(),
  recipient_email: z.string().email().optional().or(z.literal("")),
  recipient_name: z.string().trim().optional(),
  personal_message: z.string().trim().optional(),
  /** A physical extra chosen on the gift page, shipped or handed over at the salon. */
  addon: AddonSelectionSchema.optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    // Said plainly rather than as a generic 500: on an environment without Stripe keys (the demo) nothing else is wrong.
    if (!isStripeEnabled) {
      return NextResponse.json({ error: "Le paiement en ligne n'est pas configuré sur ce site (clé Stripe absente) : la carte cadeau ne peut pas être achetée ici." }, { status: 503 })
    }
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

    // Checked here too: the gift page hides these, but the id can be posted directly.
    if (!isGiftCardEligible(service)) {
      return NextResponse.json({ error: GIFT_CARD_INELIGIBLE_MESSAGE }, { status: 400 })
    }

    // The extra is priced from the catalogue, never from the browser.
    let addon: {
      addon_id: string
      name: string
      quantity: number
      price_cents: number
      delivery_fee_cents: number
      requires_shipping: boolean
      shipping: typeof payload.addon extends infer T ? T extends { shipping?: infer S } ? S | null : null : null
      extra_answers: Record<string, string>
    } | null = null
    if (payload.addon) {
      const { data: catalogueAddon, error: addonError } = await supabase
        .from("gift_card_addons")
        .select("id, name, price_cents, delivery_fee_cents, requires_shipping, extra_fields, is_active")
        .eq("id", payload.addon.addon_id)
        .maybeSingle()
      if (addonError) throw addonError
      if (!catalogueAddon || !catalogueAddon.is_active) {
        return NextResponse.json({ error: "Ce cadeau physique n'est plus proposé." }, { status: 400 })
      }
      try {
        validateAddonSelection(catalogueAddon, payload.addon)
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Cadeau physique incomplet" }, { status: 400 })
      }
      addon = {
        addon_id: catalogueAddon.id,
        name: catalogueAddon.name,
        quantity: payload.addon.quantity,
        price_cents: catalogueAddon.price_cents,
        delivery_fee_cents: catalogueAddon.requires_shipping ? catalogueAddon.delivery_fee_cents : 0,
        requires_shipping: catalogueAddon.requires_shipping,
        shipping: catalogueAddon.requires_shipping ? payload.addon.shipping || null : null,
        extra_answers: payload.addon.extra_answers,
      }
    }

    const priced = priceGiftCardOrder(service.price_cents, addon, addon?.quantity || 1)
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
        addon_id: addon?.addon_id || "",
      },
      line_items: buildGiftCardLineItems(service, addon, addon?.quantity || 1),
    })

    const { error: insertError } = await supabase
      .from("stripe_checkout_sessions")
      .insert([{
        checkout_type: "gift_card",
        stripe_checkout_session_id: session.id,
        status: "open",
        amount_cents: priced.total_cents,
        currency: "eur",
        payload: {
          service_id: service.id,
          buyer_name: payload.buyer_name,
          buyer_email: payload.buyer_email,
          recipient_email: payload.recipient_email || undefined,
          recipient_name: payload.recipient_name || undefined,
          personal_message: payload.personal_message || undefined,
          ...(addon ? { addon } : {}),
        },
      }])

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      session_id: session.id,
      url: session.url,
      total_cents: priced.total_cents,
    })
  } catch (error) {
    console.error("[gift-card] Purchase error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to purchase gift card" }, { status: 500 })
  }
}
