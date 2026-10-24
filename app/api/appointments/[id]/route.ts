import { createAdminClient } from "@/lib/supabase/admin"
import { validateAppointmentScheduling, validateSalonStaffScheduling } from "@/lib/appointments/create"
import { normalizeAppointmentStaff, SchedulingError } from "@/lib/appointments/rules"
import { persistAppointmentSchedule } from "@/lib/appointments/persist"
import { blocksAppointmentSchedule } from "@/lib/appointments/status"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateAppointmentSchema = z.object({
  status: z.enum(["confirmed", "in_progress", "completed", "cancelled", "no_show", "blocked"]).optional(),
  client_notes: z.string().optional(),
  internal_notes: z.string().optional(),
  payment_status: z.enum(["pending", "unpaid", "partial", "paid", "failed"]).optional(),
  payment_method: z.string().optional(),
  amount_paid_cents: z.number().optional(),
  paid_at: z.string().nullable().optional(),
  payments: z.array(z.object({
    amount_cents: z.number(),
    method: z.enum(["stripe", "gift_card", "pack", "on_site", "cash", "card", "check", "other", "treatwell", "loyalty"])
  })).optional(),
  // New fields for modification
  service_id: z.string().uuid().optional(),
  salon_id: z.string().uuid().optional(),
  start_time: z.string().datetime({ offset: true }).optional(),
  staff_ids: z.array(z.string().uuid()).min(1).optional(),
  staff_id: z.string().uuid().optional(), // Legacy support
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist", "assistant", "therapist"])
    if ("response" in auth) {
      return auth.response
    }

    const { id } = await context.params
    const body = await request.json()
    // Cancellation is a status change, not a reschedule. Ignore stale edit-form
    // fields before validation (a removed service may leave an empty UUID).
    const updates = UpdateAppointmentSchema.parse(body?.status === "cancelled" ? {
      status: "cancelled",
      client_notes: body.client_notes,
      internal_notes: body.internal_notes,
    } : body)
    if (updates.staff_id || updates.staff_ids) normalizeAppointmentStaff(updates)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Ensure appointment exists and get current data for calculations
    const { data: existing, error: existingError } = await supabase
      .from("appointments")
      .select(`
        id,
        status,
        updated_at,
        start_time,
        end_time,
        service_id,
        staff_id,
        salon_id,
        assignments:appointment_assignments(staff_id)
      `)
      .eq("id", id)
      .single()

    if (existingError) {
      return NextResponse.json({ error: existingError.message || "Failed to load appointment" }, { status: 400 })
    }

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Prepare update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.status) updateData.status = updates.status
    if (updates.client_notes !== undefined) updateData.client_notes = updates.client_notes
    if (updates.internal_notes !== undefined) updateData.internal_notes = updates.internal_notes
    if (updates.payment_status) updateData.payment_status = updates.payment_status
    if (updates.payment_method !== undefined) updateData.payment_method = updates.payment_method
    if (updates.amount_paid_cents !== undefined) updateData.amount_paid_cents = updates.amount_paid_cents
    if (updates.paid_at !== undefined) updateData.paid_at = updates.paid_at
    if (updates.salon_id) updateData.salon_id = updates.salon_id

    if (updates.payment_status === "paid" && updates.paid_at === undefined) {
      updateData.paid_at = new Date().toISOString()
    }

    let staffIdsToUpdate = updates.staff_ids
    if (!staffIdsToUpdate && updates.staff_id) {
        staffIdsToUpdate = [updates.staff_id]
    }

    const targetSalonId = updates.salon_id || existing.salon_id
    const targetServiceId = updates.service_id || existing.service_id
    const targetStartTime = updates.start_time || existing.start_time
    const existingStaffIds = Array.from(new Set<string>([
      ...(existing.staff_id ? [existing.staff_id] : []),
      ...(existing.assignments || []).map((assignment: any) => assignment.staff_id),
    ]))
    const targetStaffIds = staffIdsToUpdate ?? existingStaffIds

    if (updates.service_id) updateData.service_id = updates.service_id
    if (updates.start_time) updateData.start_time = updates.start_time

    const schedulingChanged = Boolean(
      updates.salon_id ||
      updates.service_id ||
      updates.start_time ||
      updates.staff_id ||
      updates.staff_ids
    )

    const reactivating = !blocksAppointmentSchedule(existing.status) &&
      blocksAppointmentSchedule(updates.status || existing.status)

    const isBlock = (updates.status || existing.status) === "blocked"
    if (reactivating && (!targetSalonId || (!targetServiceId && !isBlock) || targetStaffIds.length === 0)) {
      return NextResponse.json({ error: "Impossible de réactiver un rendez-vous sans salon, prestation et praticien" }, { status: 400 })
    }

    if ((schedulingChanged || reactivating) && !isBlock && targetSalonId && targetServiceId && targetStaffIds.length > 0) {
      // Preserve the booked duration unless the service itself is changed.
      // A service's catalogue duration may have changed since this booking.
      const originalDuration = new Date(existing.end_time).getTime() - new Date(existing.start_time).getTime()
      const preservedEndTime = targetServiceId === existing.service_id && originalDuration > 0
        ? new Date(new Date(targetStartTime).getTime() + originalDuration).toISOString()
        : undefined
      const { endTime } = await validateAppointmentScheduling(
        supabase,
        {
          salon_id: targetSalonId,
          service_id: targetServiceId,
          start_time: targetStartTime,
          end_time: preservedEndTime,
          staff_id: targetStaffIds[0],
          staff_ids: targetStaffIds,
        },
        {
          ignoreAppointmentId: id,
        }
      )

      updateData.end_time = endTime
    }
    if ((schedulingChanged || reactivating) && isBlock) {
      const duration = new Date(existing.end_time).getTime() - new Date(existing.start_time).getTime()
      const endTime = new Date(new Date(targetStartTime).getTime() + duration).toISOString()
      await validateSalonStaffScheduling(supabase, {
        salon_id: targetSalonId, staff_ids: targetStaffIds, start_time: targetStartTime, end_time: endTime,
      }, { checkWorkingHours: false })
      updateData.end_time = endTime
    }

    const nextStaffIds = staffIdsToUpdate ? normalizeAppointmentStaff(updates) : undefined
    if (nextStaffIds) updateData.staff_id = nextStaffIds[0]
    if (existing.updated_at) updateData.expected_updated_at = existing.updated_at
    const data = await persistAppointmentSchedule(supabase, updateData, nextStaffIds, id)

    if (updates.payments && updates.payments.length > 0) {
      const paymentRecords = updates.payments.map(p => ({
        appointment_id: id,
        amount_cents: p.amount_cents,
        method: p.method
      }))

      const { error: paymentsError } = await supabase
        .from("payments")
        .insert(paymentRecords)

      if (paymentsError) {
        throw new Error("Failed to record payments: " + paymentsError.message)
      }
    }

    return NextResponse.json(data)
  } catch (error: any) {
    if (error instanceof SchedulingError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Failed to update appointment" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
    if ("response" in auth) {
      return auth.response
    }

    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: existing } = await supabase.from("appointments").select("id").eq("id", id).single()
    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const { error } = await supabase.from("appointments").delete().eq("id", id)
    if (error) throw error

    return NextResponse.json({ message: "Appointment deleted" })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 })
  }
}
