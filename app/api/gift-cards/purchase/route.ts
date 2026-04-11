export const runtime = "nodejs"

import { createAdminClient } from "@/lib/supabase/admin"
import { sendGiftCardEmails } from "@/lib/email/gift-cards"
import { generateGiftCardCode } from "@/lib/gift-cards"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const PurchaseGiftCardSchema = z.object({
  service_id: z.string().uuid(),
  buyer_email: z.string().email(),
  recipient_email: z.string().email().optional().or(z.literal("")),
  recipient_name: z.string().trim().optional(),
  personal_message: z.string().trim().optional(),
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

    const code = await generateUniqueGiftCardCode(supabase)

    const insertPayload = {
      code,
      service_id: service.id,
      buyer_email: payload.buyer_email,
      recipient_email: payload.recipient_email || null,
      recipient_name: payload.recipient_name || null,
      personal_message: payload.personal_message || null,
      amount_cents: service.price_cents,
      status: "active" as const,
      purchased_at: new Date().toISOString(),
    }

    const { data: giftCard, error: insertError } = await supabase
      .from("gift_cards")
      .insert([insertPayload])
      .select("*")
      .single()

    if (insertError) throw insertError

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
      console.error("[gift-card] Failed to send gift card emails:", emailError)
    }

    return NextResponse.json({
      success: true,
      gift_card: {
        ...giftCard,
        service: {
          ...service,
          salon_ids: service.service_salons?.map((relation: any) => relation.salon_id) || [],
          salons: service.service_salons?.map((relation: any) => relation.salon).filter(Boolean) || [],
        },
      },
      payment: {
        status: "paid",
        simulated: true,
      },
    }, { status: 201 })
  } catch (error) {
    console.error("[gift-card] Purchase error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to purchase gift card" }, { status: 500 })
  }
}
