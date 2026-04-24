import { createAdminClient } from "@/lib/supabase/admin"
import { validateAppointmentScheduling } from "@/lib/appointments/create"
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
  start_time: z.string().optional(), // ISO string
  staff_ids: z.array(z.string().uuid()).optional(),
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
    const updates = UpdateAppointmentSchema.parse(body)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Ensure appointment exists and get current data for calculations
    const { data: existing, error: existingError } = await supabase
      .from("appointments")
      .select("id, status, start_time, service_id, staff_id, salon_id")
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
    const targetStaffIds = staffIdsToUpdate && staffIdsToUpdate.length > 0
      ? staffIdsToUpdate
      : existing.staff_id
        ? [existing.staff_id]
        : []

    if (updates.service_id) updateData.service_id = updates.service_id
    if (updates.start_time) updateData.start_time = updates.start_time

    if (targetSalonId && targetServiceId && targetStaffIds.length > 0) {
      const { endTime } = await validateAppointmentScheduling(
        supabase,
        {
          salon_id: targetSalonId,
          service_id: targetServiceId,
          start_time: targetStartTime,
          staff_id: targetStaffIds[0],
          staff_ids: targetStaffIds,
        },
        {
          ignoreAppointmentId: id,
        }
      )

      updateData.end_time = endTime
    }

    const { data: existingAssignments, error: existingAssignmentsError } = await supabase
      .from("appointment_assignments")
      .select("staff_id")
      .eq("appointment_id", id)

    if (existingAssignmentsError) {
      throw new Error(existingAssignmentsError.message)
    }

    const previousStaffIds = (existingAssignments || []).map((assignment) => assignment.staff_id)
    const normalizedStaffIdsToUpdate = staffIdsToUpdate
      ? Array.from(new Set(staffIdsToUpdate))
      : null

    if (normalizedStaffIdsToUpdate) {
      updateData.staff_id = normalizedStaffIdsToUpdate[0] || null
    }

    let assignmentsWereUpdated = false
    if (normalizedStaffIdsToUpdate) {
      const previousStaffIdSet = new Set(previousStaffIds)
      const nextStaffIdSet = new Set(normalizedStaffIdsToUpdate)
      const staffIdsToAdd = normalizedStaffIdsToUpdate.filter((staffId) => !previousStaffIdSet.has(staffId))
      const staffIdsToRemove = previousStaffIds.filter((staffId) => !nextStaffIdSet.has(staffId))

      if (staffIdsToAdd.length > 0) {
        const { error: insertAssignmentsError } = await supabase
          .from("appointment_assignments")
          .insert(
            staffIdsToAdd.map((staffId) => ({
              appointment_id: id,
              staff_id: staffId,
            }))
          )

        if (insertAssignmentsError) {
          throw new Error("Failed to update staff assignments: " + insertAssignmentsError.message)
        }

        assignmentsWereUpdated = true
      }

      if (staffIdsToRemove.length > 0) {
        const { error: deleteAssignmentsError } = await supabase
          .from("appointment_assignments")
          .delete()
          .eq("appointment_id", id)
          .in("staff_id", staffIdsToRemove)

        if (deleteAssignmentsError) {
          if (staffIdsToAdd.length > 0) {
            await supabase
              .from("appointment_assignments")
              .delete()
              .eq("appointment_id", id)
              .in("staff_id", staffIdsToAdd)
          }

          throw new Error("Failed to update staff assignments: " + deleteAssignmentsError.message)
        }

        assignmentsWereUpdated = true
      }
    }

    // Perform update
    const { data, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .select(
        `*,
        client:clients(*),
        staff:staff(id, first_name, last_name, role, phone),
        service:services(*),
        salon:salons(id, name, city, address)`
      )
      .single()

    if (error) {
      if (assignmentsWereUpdated) {
        await supabase.from("appointment_assignments").delete().eq("appointment_id", id)

        if (existingAssignments && existingAssignments.length > 0) {
          await supabase.from("appointment_assignments").insert(
            existingAssignments.map((assignment) => ({
              appointment_id: id,
              staff_id: assignment.staff_id,
            }))
          )
        }
      }

      // Likely a Postgres CHECK constraint error when setting unknown status
      const message = error.message?.includes("status")
        ? "Invalid status value for appointment"
        : error.message
      return NextResponse.json({ error: message || "Failed to update appointment" }, { status: 400 })
    }

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
