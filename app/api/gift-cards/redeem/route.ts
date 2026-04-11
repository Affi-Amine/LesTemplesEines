export const runtime = "nodejs"

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeGiftCardCode } from "@/lib/gift-cards"
import { sendAppointmentBookedEmails } from "@/lib/email/notifications"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const PhoneSchema = z
  .string()
  .transform((s) => (s || "").replace(/[\s\u00A0\-\.\(\)\/]/g, ""))
  .refine((s) => /^\+?[0-9]{9,}$/.test(s), { message: "Invalid phone number format" })

const RedeemGiftCardSchema = z.object({
  code: z.string().min(1),
  salon_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: z.string(),
  staff_ids: z.array(z.string().uuid()).min(1),
  client_data: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    phone: PhoneSchema,
    email: z.string().email().optional(),
  }),
  client_notes: z.string().optional(),
})

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

    let clientId: string | undefined

    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", payload.client_data.phone)
      .maybeSingle()

    if (existingClient?.id) {
      clientId = existingClient.id
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert([payload.client_data])
        .select("id")
        .single()

      if (clientError) throw clientError

      clientId = newClient.id

      await supabase.from("loyalty_points").insert([{
        client_id: newClient.id,
        points_balance: 0,
        total_earned: 0,
        total_redeemed: 0,
      }])
    }

    const startDate = new Date(payload.start_time)
    const endDate = new Date(startDate.getTime() + (giftCard.service?.duration_minutes || 60) * 60000)

    for (const staffId of assignedStaffIds) {
      const { data: conflicts, error: conflictError } = await supabase
        .from("appointments")
        .select("id")
        .eq("staff_id", staffId)
        .in("status", ["confirmed", "pending", "blocked"])
        .lt("start_time", endDate.toISOString())
        .gt("end_time", payload.start_time)

      if (conflictError) throw conflictError
      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({ error: "Un ou plusieurs créneaux ne sont plus disponibles" }, { status: 409 })
      }

      const { data: deepConflicts, error: deepConflictError } = await supabase
        .from("appointment_assignments")
        .select("appointment:appointments!inner(start_time, end_time, status)")
        .eq("staff_id", staffId)
        .filter("appointment.status", "in", '("confirmed","pending","blocked")')
        .filter("appointment.start_time", "lt", endDate.toISOString())
        .filter("appointment.end_time", "gt", payload.start_time)

      if (deepConflictError) throw deepConflictError
      if (deepConflicts && deepConflicts.length > 0) {
        return NextResponse.json({ error: "Un ou plusieurs créneaux ne sont plus disponibles" }, { status: 409 })
      }
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert([{
        salon_id: payload.salon_id,
        client_id: clientId,
        staff_id: assignedStaffIds[0],
        service_id: payload.service_id,
        start_time: payload.start_time,
        end_time: endDate.toISOString(),
        client_notes: payload.client_notes || null,
        status: "confirmed",
        payment_status: "paid",
        payment_method: "gift_card",
        amount_paid_cents: giftCard.amount_cents,
      }])
      .select(`
        *,
        client:clients(*),
        staff:staff(id, first_name, last_name, role, phone),
        service:services(*),
        salon:salons(id, name, city, address)
      `)
      .single()

    if (appointmentError) throw appointmentError

    const { error: assignmentError } = await supabase
      .from("appointment_assignments")
      .insert(assignedStaffIds.map((staffId) => ({
        appointment_id: appointment.id,
        staff_id: staffId,
      })))

    if (assignmentError) throw assignmentError

    const { error: paymentInsertError } = await supabase
      .from("payments")
      .insert([{
        appointment_id: appointment.id,
        amount_cents: giftCard.amount_cents,
        method: "gift_card",
        notes: `Redeemed gift card ${giftCard.code}`,
      }])

    if (paymentInsertError) throw paymentInsertError

    const { error: giftCardUpdateError } = await supabase
      .from("gift_cards")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
        redeemed_appointment_id: appointment.id,
      })
      .eq("id", giftCard.id)

    if (giftCardUpdateError) throw giftCardUpdateError

    try {
      await sendAppointmentBookedEmails(appointment)
    } catch (emailError) {
      console.error("[gift-card] Failed to send appointment emails:", emailError)
    }

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
