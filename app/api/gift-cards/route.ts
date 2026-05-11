import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { generateGiftCardCode } from "@/lib/gift-cards"
import { sendGiftCardEmails } from "@/lib/email/gift-cards"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const CounterGiftCardSchema = z.object({
  service_id: z.string().uuid(),
  buyer_name: z.string().trim().min(1),
  buyer_email: z.string().trim().email(),
  recipient_email: z.string().trim().email().optional().or(z.literal("")),
  recipient_name: z.string().trim().optional(),
  personal_message: z.string().trim().optional(),
  send_email: z.boolean().optional(),
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
    const code = await generateUniqueGiftCardCode(supabase)
    const { data: giftCard, error: insertError } = await supabase
      .from("gift_cards")
      .insert([{
        code,
        service_id: service.id,
        buyer_email: payload.buyer_email.toLowerCase(),
        recipient_email: payload.recipient_email ? payload.recipient_email.toLowerCase() : null,
        recipient_name: payload.recipient_name || null,
        personal_message: payload.personal_message || null,
        amount_cents: service.price_cents,
        status: "active",
        purchased_at: now,
        payment_status: "paid",
        paid_at: now,
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
        )
      `)
      .single()

    if (insertError || !giftCard) {
      throw new Error(insertError?.message || "Failed to create gift card")
    }

    if (payload.send_email !== false) {
      try {
        await sendGiftCardEmails({
          buyerName: payload.buyer_name,
          buyerEmail: giftCard.buyer_email,
          recipientEmail: giftCard.recipient_email,
          recipientName: giftCard.recipient_name,
          personalMessage: giftCard.personal_message,
          serviceName: service.name,
          code: giftCard.code,
        })
      } catch (emailError) {
        console.error("[gift-cards] Counter sale email error:", emailError)
      }
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
