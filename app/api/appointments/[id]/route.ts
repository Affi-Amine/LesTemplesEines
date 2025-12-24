import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateAppointmentSchema = z.object({
  status: z.enum(["confirmed", "in_progress", "completed", "cancelled", "no_show", "blocked"]).optional(),
  client_notes: z.string().optional(),
  internal_notes: z.string().optional(),
  payment_status: z.enum(["unpaid", "partial", "paid"]).optional(),
  payment_method: z.string().optional(),
  amount_paid_cents: z.number().optional(),
  payments: z.array(z.object({
    amount_cents: z.number(),
    method: z.enum(["cash", "card", "check", "other", "treatwell", "gift_card", "loyalty"])
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
    const { id } = await context.params
    const body = await request.json()
    const updates = UpdateAppointmentSchema.parse(body)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Ensure appointment exists and get current data for calculations
    const { data: existing } = await supabase
      .from("appointments")
      .select("id, status, start_time, service_id, staff_id")
      .eq("id", id)
      .single()

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
    if (updates.salon_id) updateData.salon_id = updates.salon_id

    // Handle Service/Time updates (recalculate end_time)
    if (updates.service_id || updates.start_time) {
      const serviceId = updates.service_id || existing.service_id
      const startTimeStr = updates.start_time || existing.start_time
      
      if (updates.service_id) updateData.service_id = updates.service_id
      if (updates.start_time) updateData.start_time = updates.start_time

      // Get service duration
      const { data: service } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", serviceId)
        .single()

      if (service) {
        const startDate = new Date(startTimeStr)
        const endDate = new Date(startDate.getTime() + service.duration_minutes * 60000)
        updateData.end_time = endDate.toISOString()
      }
    }

    // Handle Staff updates
    let staffIdsToUpdate = updates.staff_ids
    if (!staffIdsToUpdate && updates.staff_id) {
        staffIdsToUpdate = [updates.staff_id]
    }

    if (staffIdsToUpdate) {
        // Update primary staff_id (use first one)
        updateData.staff_id = staffIdsToUpdate[0]

        // Update assignments table
        // First delete existing assignments
        await supabase
            .from("appointment_assignments")
            .delete()
            .eq("appointment_id", id)
        
        // Then insert new ones
        if (staffIdsToUpdate.length > 0) {
            const assignments = staffIdsToUpdate.map(staffId => ({
                appointment_id: id,
                staff_id: staffId
            }))
            
            const { error: assignmentError } = await supabase
                .from("appointment_assignments")
                .insert(assignments)
            
            if (assignmentError) {
                throw new Error("Failed to update staff assignments: " + assignmentError.message)
            }
        }
    }

    // Handle multiple payments if provided
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
      // Likely a Postgres CHECK constraint error when setting unknown status
      const message = error.message?.includes("status")
        ? "Invalid status value for appointment"
        : error.message
      return NextResponse.json({ error: message || "Failed to update appointment" }, { status: 400 })
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
