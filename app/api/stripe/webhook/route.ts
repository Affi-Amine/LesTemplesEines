export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, stripeWebhookSecret } from "@/lib/stripe"
import { generateGiftCardCode } from "@/lib/gift-cards"
import { sendGiftCardEmails } from "@/lib/email/gift-cards"
import { createBookableAppointment } from "@/lib/appointments/create"
import { sendAppointmentBookedEmails } from "@/lib/email/notifications"
import { ensureClientAccount } from "@/lib/client-auth"
import { sendPackReadyEmail } from "@/lib/email/packs"
import { getPackPaymentStatus } from "@/lib/packs"

const GiftCardPayloadSchema = z.object({
  service_id: z.string().uuid(),
  buyer_email: z.string().email(),
  recipient_email: z.string().email().optional(),
  recipient_name: z.string().optional(),
  personal_message: z.string().optional(),
})

const PackPayloadSchema = z.object({
  pack_id: z.string().uuid(),
  installment_count: z.number().int().min(1).max(3),
  installment_amounts: z.array(z.number().int().positive()).min(1),
  customer_email: z.string().email(),
  customer_name: z.string().min(1),
})

async function generateUniqueGiftCardCode(supabase: ReturnType<typeof createAdminClient>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateGiftCardCode()
    const { data: existing, error } = await supabase
      .from("gift_cards")
      .select("id")
      .eq("code", code)
      .maybeSingle()

    if (error) throw error
    if (!existing) return code
  }

  throw new Error("Unable to generate a unique gift card code")
}

async function markCheckoutSession(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  updates: Record<string, unknown>
) {
  await supabase
    .from("stripe_checkout_sessions")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", sessionId)
}

async function handleGiftCardCheckout(
  supabase: ReturnType<typeof createAdminClient>,
  checkoutSession: any,
  storedSession: any
) {
  if (storedSession.gift_card_id) {
    return
  }

  const payload = GiftCardPayloadSchema.parse(storedSession.payload)
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, price_cents")
    .eq("id", payload.service_id)
    .single()

  if (serviceError || !service) {
    throw new Error("Service not found for gift card payment")
  }

  const code = await generateUniqueGiftCardCode(supabase)

  const { data: giftCard, error: insertError } = await supabase
    .from("gift_cards")
    .insert([{
      code,
      service_id: service.id,
      buyer_email: payload.buyer_email,
      recipient_email: payload.recipient_email || null,
      recipient_name: payload.recipient_name || null,
      personal_message: payload.personal_message || null,
      amount_cents: service.price_cents,
      status: "active",
      purchased_at: new Date().toISOString(),
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: checkoutSession.id,
      stripe_payment_intent_id: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null,
    }])
    .select("*")
    .single()

  if (insertError || !giftCard) {
    throw new Error(insertError?.message || "Failed to create gift card")
  }

  try {
    await sendGiftCardEmails({
      buyerEmail: giftCard.buyer_email,
      recipientEmail: giftCard.recipient_email,
      recipientName: giftCard.recipient_name,
      personalMessage: giftCard.personal_message,
      serviceName: service.name,
      code: giftCard.code,
    })
  } catch (emailError) {
    console.error("[stripe] Failed to send gift card emails:", emailError)
  }

  if (typeof checkoutSession.payment_intent === "string") {
    try {
      await getStripeClient().paymentIntents.update(checkoutSession.payment_intent, {
        metadata: {
          type: "gift_card",
          service_id: service.id,
          gift_card_id: giftCard.id,
          appointment_id: "",
        },
      })
    } catch (stripeError) {
      console.error("[stripe] Failed to update payment intent metadata for gift card:", stripeError)
    }
  }

  await markCheckoutSession(supabase, checkoutSession.id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    gift_card_id: giftCard.id,
    stripe_payment_intent_id: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null,
  })
}

async function handleAppointmentCheckout(
  supabase: ReturnType<typeof createAdminClient>,
  checkoutSession: any,
  storedSession: any
) {
  if (storedSession.appointment_id) {
    return
  }

  const payload = storedSession.payload
  const appointment = await createBookableAppointment(supabase, {
    ...payload,
    payment_status: "paid",
    payment_method: "stripe",
    amount_paid_cents: storedSession.amount_cents,
    paid_at: new Date().toISOString(),
  }, {
    paymentRecord: {
      method: "stripe",
      amount_cents: storedSession.amount_cents,
      reference: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : checkoutSession.id,
      notes: `Stripe Checkout ${checkoutSession.id}`,
    },
  })

  await supabase
    .from("appointments")
    .update({
      stripe_checkout_session_id: checkoutSession.id,
      stripe_payment_intent_id: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null,
    })
    .eq("id", appointment.id)

  if (typeof checkoutSession.payment_intent === "string") {
    try {
      await getStripeClient().paymentIntents.update(checkoutSession.payment_intent, {
        metadata: {
          type: "appointment",
          service_id: String(payload.service_id || ""),
          appointment_id: appointment.id,
        },
      })
    } catch (stripeError) {
      console.error("[stripe] Failed to update payment intent metadata for appointment:", stripeError)
    }
  }

  await markCheckoutSession(supabase, checkoutSession.id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    appointment_id: appointment.id,
    stripe_payment_intent_id: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null,
  })

  try {
    await sendAppointmentBookedEmails(appointment)
  } catch (emailError) {
    console.error("[stripe] Failed to send appointment emails:", emailError)
  }
}

async function configurePackSubscriptionSchedule(params: {
  stripe: Stripe
  subscriptionId: string
  packName: string
  installmentAmounts: number[]
}) {
  const subscription = await params.stripe.subscriptions.retrieve(params.subscriptionId)
  const item = subscription.items.data[0]

  if (!item?.price?.id) {
    throw new Error("Subscription item not found for installment plan")
  }

  const productId = typeof item.price.product === "string" ? item.price.product : item.price.product?.id

  if (!productId) {
    throw new Error("Subscription product not found for installment plan")
  }

  const schedule = await params.stripe.subscriptionSchedules.create({
    from_subscription: params.subscriptionId,
  })

  const phases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [
    {
      items: [{
        price: item.price.id,
        quantity: item.quantity || 1,
      }],
      iterations: 1,
    },
  ]

  for (let index = 1; index < params.installmentAmounts.length; index += 1) {
    phases.push({
      items: [{
        price_data: {
          currency: "eur",
          unit_amount: params.installmentAmounts[index],
          product: productId,
          recurring: {
            interval: "month",
            interval_count: 1,
          },
        },
        quantity: 1,
      }],
      iterations: 1,
    })
  }

  return params.stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "cancel",
    phases,
  })
}

async function handlePackCheckout(
  supabase: ReturnType<typeof createAdminClient>,
  checkoutSession: Stripe.Checkout.Session,
  storedSession: any
) {
  if (storedSession.client_pack_id) {
    return
  }

  const payload = PackPayloadSchema.parse(storedSession.payload)
  const { data: pack, error: packError } = await supabase
    .from("packs")
    .select("*")
    .eq("id", payload.pack_id)
    .single()

  if (packError || !pack) {
    throw new Error("Pack not found for payment")
  }

  const { client } = await ensureClientAccount({
    email: payload.customer_email,
    fullName: payload.customer_name,
  })

  const stripe = getStripeClient()
  let subscriptionScheduleId: string | null = null
  const subscriptionId = typeof checkoutSession.subscription === "string" ? checkoutSession.subscription : null

  if (subscriptionId && payload.installment_count > 1) {
    const schedule = await configurePackSubscriptionSchedule({
      stripe,
      subscriptionId,
      packName: pack.name,
      installmentAmounts: payload.installment_amounts,
    })
    subscriptionScheduleId = schedule.id
  }

  const paidInstallments = checkoutSession.mode === "subscription" ? 1 : payload.installment_count
  const paymentStatus =
    payload.installment_count === 1
      ? "paid"
      : getPackPaymentStatus(payload.installment_count, paidInstallments)

  const { data: clientPack, error: insertError } = await supabase
    .from("client_packs")
    .insert([{
      client_id: client.id,
      pack_id: pack.id,
      total_sessions: pack.number_of_sessions,
      remaining_sessions: pack.number_of_sessions,
      installment_count: payload.installment_count,
      paid_installments: paidInstallments,
      purchase_date: new Date().toISOString(),
      payment_status: paymentStatus === "pending" ? "active" : paymentStatus,
      stripe_subscription_id: subscriptionId,
      stripe_subscription_schedule_id: subscriptionScheduleId,
      stripe_checkout_session_id: checkoutSession.id,
    }])
    .select("*")
    .single()

  if (insertError || !clientPack) {
    throw new Error(insertError?.message || "Failed to create client pack")
  }

  await markCheckoutSession(supabase, checkoutSession.id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    client_pack_id: clientPack.id,
    stripe_subscription_id: subscriptionId,
    stripe_subscription_schedule_id: subscriptionScheduleId,
  })

  try {
    await sendPackReadyEmail({
      to: payload.customer_email,
      packName: pack.name,
      totalSessions: pack.number_of_sessions,
      purchaseDate: clientPack.purchase_date,
      price: Number(pack.price),
    })
  } catch (emailError) {
    console.error("[stripe] Failed to send pack ready email:", emailError)
  }
}

export async function POST(request: NextRequest) {
  if (!stripeWebhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 500 })
  }

  try {
    const signature = request.headers.get("stripe-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
    }

    const body = await request.text()
    const stripe = getStripeClient()
    const event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret)
    const supabase = createAdminClient()

    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      const { data: storedSession, error } = await supabase
        .from("stripe_checkout_sessions")
        .select("*")
        .eq("stripe_checkout_session_id", checkoutSession.id)
        .maybeSingle()

      if (error) throw error
      if (!storedSession) {
        return NextResponse.json({ received: true })
      }

      if (storedSession.status === "completed") {
        return NextResponse.json({ received: true })
      }

      if (checkoutSession.payment_status !== "paid" && checkoutSession.payment_status !== "no_payment_required") {
        await markCheckoutSession(supabase, checkoutSession.id, { status: "failed" })
        return NextResponse.json({ received: true })
      }

      try {
        if (storedSession.checkout_type === "gift_card") {
          await handleGiftCardCheckout(supabase, checkoutSession, storedSession)
        } else if (storedSession.checkout_type === "appointment") {
          await handleAppointmentCheckout(supabase, checkoutSession, storedSession)
        } else if (storedSession.checkout_type === "pack") {
          await handlePackCheckout(supabase, checkoutSession, storedSession)
        }
      } catch (processingError) {
        console.error("[stripe] Webhook processing error:", processingError)
        await markCheckoutSession(supabase, checkoutSession.id, { status: "failed" })
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      if (typeof paymentIntent.metadata?.appointment_id === "string" && paymentIntent.metadata.appointment_id) {
        await supabase
          .from("appointments")
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            paid_at: new Date().toISOString(),
          })
          .eq("id", paymentIntent.metadata.appointment_id)
      }

      if (typeof paymentIntent.metadata?.gift_card_id === "string" && paymentIntent.metadata.gift_card_id) {
        await supabase
          .from("gift_cards")
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            paid_at: new Date().toISOString(),
          })
          .eq("id", paymentIntent.metadata.gift_card_id)
      }

      await supabase
        .from("stripe_checkout_sessions")
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", paymentIntent.id)
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as any
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null

      if (subscriptionId) {
        const { data: clientPack } = await supabase
          .from("client_packs")
          .select("*")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle()

        if (clientPack) {
          if (invoice.billing_reason === "subscription_create" && (clientPack.paid_installments || 0) >= 1) {
            return NextResponse.json({ received: true })
          }

          const nextPaidInstallments = Math.min(
            clientPack.installment_count || 1,
            Math.max(clientPack.paid_installments || 0, 0) + 1
          )

          await supabase
            .from("client_packs")
            .update({
              paid_installments: nextPaidInstallments,
              payment_status: getPackPaymentStatus(clientPack.installment_count || 1, nextPaidInstallments),
            })
            .eq("id", clientPack.id)
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as any
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null

      if (subscriptionId) {
        await supabase
          .from("client_packs")
          .update({
            payment_status: "failed",
          })
          .eq("stripe_subscription_id", subscriptionId)
      }
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      await markCheckoutSession(createAdminClient(), checkoutSession.id, { status: "failed" })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[stripe] Webhook error:", error)
    return NextResponse.json({ error: "Webhook error" }, { status: 400 })
  }
}
