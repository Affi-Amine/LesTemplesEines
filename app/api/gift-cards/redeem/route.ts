export const runtime = "nodejs"

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeGiftCardCode } from "@/lib/gift-cards"
import { sendAppointmentBookedEmails } from "@/lib/email/notifications"
import { ClientDataSchema, createBookableAppointment } from "@/lib/appointments/create"
import { after, type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const RedeemGiftCardSchema = z.object({
  code: z.string().min(1),
  salon_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: z.string(),
  staff_ids: z.array(z.string().uuid()).min(1),
  client_data: ClientDataSchema,
  client_notes: z.string().optional(),
})

function scheduleGiftCardAppointmentNotifications(appointment: any) {
  after(async () => {
    try {
      await sendAppointmentBookedEmails(appointment, {
        bookingSource: "client",
      })
    } catch (error) {
      console.error("[gift-card] Failed to send appointment emails:", error)
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = RedeemGiftCardSchema.parse(body)
    const supabase = createAdminClient()
    const code = normalizeGiftCardCode(payload.code)

    const { data: giftCard, error: giftCardError } = await supabase
      .from("gift_cards")
      .select(`
        *,
        service:services(
          id,
          name,
          duration_minutes,
          price_cents,
          required_staff_count
        )
      `)
      .eq("code", code)
      .maybeSingle()

    if (giftCardError) throw giftCardError

    if (!giftCard) {
      return NextResponse.json({ error: "Carte cadeau introuvable" }, { status: 404 })
    }

    if (giftCard.status !== "active" || giftCard.used_at) {
      return NextResponse.json({ error: "Cette carte cadeau n'est plus valide" }, { status: 400 })
    }

    if (giftCard.service_id !== payload.service_id) {
      return NextResponse.json({ error: "La prestation sélectionnée ne correspond pas à la carte cadeau" }, { status: 400 })
    }

    const { data: serviceSalon, error: serviceSalonError } = await supabase
      .from("service_salons")
      .select("service_id")
      .eq("service_id", payload.service_id)
      .eq("salon_id", payload.salon_id)
      .maybeSingle()

    if (serviceSalonError) throw serviceSalonError

    if (!serviceSalon) {
      return NextResponse.json({ error: "Cette prestation n'est pas disponible dans le salon sélectionné" }, { status: 400 })
    }

    const requiredStaffCount = giftCard.service?.required_staff_count || 1
    const assignedStaffIds = payload.staff_ids.slice(0, requiredStaffCount)

    if (assignedStaffIds.length < requiredStaffCount) {
      return NextResponse.json({ error: "Pas assez de prestataires assignés pour cette prestation" }, { status: 400 })
    }

    const appointment = await createBookableAppointment(supabase, {
      salon_id: payload.salon_id,
      service_id: payload.service_id,
      start_time: payload.start_time,
      staff_id: assignedStaffIds[0],
      staff_ids: assignedStaffIds,
      client_data: payload.client_data,
      client_notes: payload.client_notes,
      status: "confirmed",
      payment_status: "paid",
      payment_method: "gift_card",
      amount_paid_cents: giftCard.amount_cents,
      paid_at: new Date().toISOString(),
    }, {
      paymentRecord: {
        amount_cents: giftCard.amount_cents,
        method: "gift_card",
        notes: `Redeemed gift card ${giftCard.code}`,
      },
    })

    const { error: giftCardUpdateError } = await supabase
      .from("gift_cards")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
        redeemed_appointment_id: appointment.id,
      })
      .eq("id", giftCard.id)

    if (giftCardUpdateError) throw giftCardUpdateError

    scheduleGiftCardAppointmentNotifications(appointment)

    return NextResponse.json({
      success: true,
      appointment,
      gift_card: {
        id: giftCard.id,
        code: giftCard.code,
        status: "used",
        redeemed_appointment_id: appointment.id,
      },
    }, { status: 201 })
  } catch (error) {
    console.error("[gift-card] Redeem error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to redeem gift card" }, { status: 500 })
  }
}
