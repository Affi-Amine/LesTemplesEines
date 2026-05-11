import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { generateGiftCardCode } from "@/lib/gift-cards"
import { sendGiftCardEmails } from "@/lib/email/gift-cards"
import { sendCounterSaleAdminEmail } from "@/lib/email/sale-notifications"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const CounterGiftCardSchema = z.object({
  service_id: z.string().uuid(),
  buyer_name: z.string().trim().min(1),
  buyer_email: z.string().trim().email(),
  recipient_email: z.string().trim().email().optional().or(z.literal("")),
  recipient_name: z.string().trim().optional(),
  personal_message: z.string().trim().optional(),
  payment_method: z.enum(["cash", "card", "check", "other", "on_site"]),
  send_email: z.boolean().optional(),
  send_recipient_email: z.boolean().optional(),
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

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")
    const status = request.nextUrl.searchParams.get("status")

    const supabase = createAdminClient()

    let query = supabase
      .from("gift_cards")
      .select(`
        *,
        service:services(
          id,
          name,
          duration_minutes,
          price_cents
        ),
        appointment:appointments(
          id,
          start_time,
          salon:salons(id, name, city)
        ),
        sold_by:staff(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    if (search) {
      query = query.or(
        `code.ilike.%${search}%,buyer_email.ilike.%${search}%,recipient_email.ilike.%${search}%,recipient_name.ilike.%${search}%`,
      )
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[gift-cards] Get gift cards error:", error)
    return NextResponse.json({ error: "Failed to fetch gift cards" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
    if ("response" in auth) {
      return auth.response
    }

    const payload = CounterGiftCardSchema.parse(await request.json())
    const supabase = createAdminClient()

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, price_cents, is_active")
      .eq("id", payload.service_id)
      .single()

    if (serviceError || !service || service.is_active === false) {
      return NextResponse.json({ error: "Service introuvable ou inactif" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { data: seller } = await supabase
      .from("staff")
      .select("id, first_name, last_name, email")
      .eq("id", auth.payload.staffId)
      .maybeSingle()

    const code = await generateUniqueGiftCardCode(supabase)
    const { data: giftCard, error: insertError } = await supabase
      .from("gift_cards")
      .insert([{
        code,
        service_id: service.id,
        buyer_name: payload.buyer_name,
        buyer_email: payload.buyer_email.toLowerCase(),
        recipient_email: payload.recipient_email ? payload.recipient_email.toLowerCase() : null,
        recipient_name: payload.recipient_name || null,
        personal_message: payload.personal_message || null,
        amount_cents: service.price_cents,
        status: "active",
        purchased_at: now,
        payment_status: "paid",
        payment_method: payload.payment_method,
        paid_at: now,
        sold_by_staff_id: auth.payload.staffId,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
      }])
      .select(`
        *,
        service:services(
          id,
          name,
          duration_minutes,
          price_cents
        ),
        appointment:appointments(
          id,
          start_time,
          salon:salons(id, name, city)
        ),
        sold_by:staff(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (insertError || !giftCard) {
      throw new Error(insertError?.message || "Failed to create gift card")
    }

    try {
      await supabase.from("activity_logs").insert([{
        salon_id: auth.payload.salonId,
        actor_id: auth.payload.staffId,
        action_type: "counter_gift_card_sale",
        entity_type: "gift_card",
        entity_id: giftCard.id,
        changes: {
          buyer_email: giftCard.buyer_email,
          service_id: service.id,
          amount_cents: service.price_cents,
          payment_method: payload.payment_method,
        },
      }])
    } catch (logError) {
      console.error("[gift-cards] Counter sale activity log error:", logError)
    }

    try {
      await sendGiftCardEmails({
        buyerName: payload.buyer_name,
        buyerEmail: giftCard.buyer_email,
        recipientEmail: giftCard.recipient_email,
        recipientName: giftCard.recipient_name,
        personalMessage: giftCard.personal_message,
        serviceName: service.name,
        code: giftCard.code,
        paymentMethod: payload.payment_method,
        purchaseSource: "counter",
        sendRecipientEmail: payload.send_recipient_email !== false,
      })
    } catch (emailError) {
      console.error("[gift-cards] Counter sale email error:", emailError)
    }

    try {
      const sellerName = seller ? `${seller.first_name || ""} ${seller.last_name || ""}`.trim() : auth.payload.email
      await sendCounterSaleAdminEmail({
        saleType: "gift_card",
        itemName: service.name,
        amountLabel: `${(service.price_cents / 100).toFixed(2)} EUR`,
        customerName: payload.buyer_name,
        customerEmail: giftCard.buyer_email,
        paymentMethod: payload.payment_method,
        soldByName: sellerName,
        soldByEmail: seller?.email || auth.payload.email,
        purchasedAt: giftCard.purchased_at,
      })
    } catch (emailError) {
      console.error("[gift-cards] Counter sale admin email error:", emailError)
    }

    return NextResponse.json(giftCard, { status: 201 })
  } catch (error) {
    console.error("[gift-cards] Counter sale error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create gift card" }, { status: 500 })
  }
}
