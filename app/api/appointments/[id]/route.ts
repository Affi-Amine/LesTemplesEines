import { createAdminClient } from "@/lib/supabase/admin"
import { assertStaffAvailable, validateAppointmentScheduling } from "@/lib/appointments/create"
import { SchedulingError } from "@/lib/appointments/rules"
import { planServiceChangePayment, type ServiceChangePayment } from "@/lib/appointments/service-change"
import { blocksAppointmentSchedule, canRescheduleAppointmentStatus } from "@/lib/appointments/status"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { presentAppointmentServices } from "@/lib/appointments/service-selection"

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateAppointmentSchema = z.object({
  expected_updated_at: z.string().refine(value => Number.isFinite(Date.parse(value)), "Version invalide").optional(),
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
  end_time: z.string().optional(), // ISO string, only honoured for blocked slots
  staff_ids: z.array(z.string().uuid()).min(1).optional(),
  staff_id: z.string().uuid().optional(), // Legacy support
  // Runs every check and returns the outcome (times, team, payment) without saving.
  dry_run: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist", "assistant", "therapist"])
    if ("response" in auth) {
      return auth.response
    }

    const { id } = await context.params
    const body = await request.json()
    // Cancellation/absence is a status change, not a reschedule. Ignore stale edit-form
    // fields before validation (a removed service may leave an empty UUID).
    const { expected_updated_at, dry_run, ...updates } = UpdateAppointmentSchema.parse(["cancelled", "no_show"].includes(body?.status) ? {
      status: body.status,
      client_notes: body.client_notes,
      internal_notes: body.internal_notes,
    } : body)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Ensure appointment exists and get current data for calculations
    const { data: existing, error: existingError } = await supabase
      .from("appointments")
      .select(`
        *,
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

    if (expected_updated_at && Date.parse(expected_updated_at) !== Date.parse(existing.updated_at)) {
      return NextResponse.json({ error: "Ce rendez-vous a été modifié. Actualisez le planning avant de réessayer." }, { status: 409 })
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
    const existingStaffIds = existing.assignments?.length
      ? existing.assignments.map((assignment: any) => assignment.staff_id)
      : existing.staff_id
        ? [existing.staff_id]
        : []
    const targetStaffIds = staffIdsToUpdate ?? existingStaffIds

    if (updates.service_id) {
      updateData.service_id = updates.service_id
      if (updates.service_id !== existing.service_id) updateData.service_items = null
    }
    if (updates.start_time) updateData.start_time = updates.start_time

    // A blocked slot that stays blocked can be moved, resized or given to other
    // masseuses; it has no service, so it is checked on its own below.
    const editingBlockedSlot = existing.status === "blocked" && (!updates.status || updates.status === "blocked")

    const schedulingChanged = Boolean(
      (updates.salon_id && updates.salon_id !== existing.salon_id) ||
      (updates.service_id && updates.service_id !== existing.service_id) ||
      (updates.start_time && Date.parse(updates.start_time) !== Date.parse(existing.start_time)) ||
      (editingBlockedSlot && updates.end_time && Date.parse(updates.end_time) !== Date.parse(existing.end_time)) ||
      (staffIdsToUpdate && [...new Set(targetStaffIds)].sort().join() !== [...new Set(existingStaffIds)].sort().join())
    )

    const reactivating = !blocksAppointmentSchedule(existing.status) &&
      blocksAppointmentSchedule(updates.status || existing.status)

    if (schedulingChanged && !reactivating && !editingBlockedSlot && !canRescheduleAppointmentStatus(existing.status)) {
      return NextResponse.json({ error: "Un soin commencé, terminé ou annulé ne peut pas être déplacé. Corrigez son statut dans sa fiche si nécessaire." }, { status: 400 })
    }

    if (!editingBlockedSlot && (schedulingChanged || reactivating) && (!targetSalonId || !targetServiceId || targetStaffIds.length === 0)) {
      return NextResponse.json({ error: "Impossible de planifier ce rendez-vous sans salon, prestation et praticien" }, { status: 400 })
    }

    let servicePayment: ServiceChangePayment | null = null

    if (editingBlockedSlot && schedulingChanged) {
      // A plain move keeps the block's length; its end is only changed on purpose.
      const originalDuration = Date.parse(existing.end_time) - Date.parse(existing.start_time)
      const blockEnd = updates.end_time ||
        (updates.start_time ? new Date(Date.parse(updates.start_time) + originalDuration).toISOString() : existing.end_time)
      if (!(Date.parse(blockEnd) > Date.parse(targetStartTime))) {
        return NextResponse.json({ error: "L'heure de fin doit être après l'heure de début" }, { status: 400 })
      }
      if (targetStaffIds.length === 0) {
        return NextResponse.json({ error: "Choisissez au moins une masseuse" }, { status: 400 })
      }
      try {
        await assertStaffAvailable(supabase, targetStaffIds, targetStartTime, blockEnd, id)
      } catch (error) {
        if (error instanceof SchedulingError) {
          return NextResponse.json({ error: "Une masseuse a déjà un rendez-vous ou un autre blocage sur ce créneau" }, { status: 409 })
        }
        throw error
      }
      updateData.end_time = blockEnd
    } else if ((schedulingChanged || reactivating) && targetSalonId && targetServiceId && targetStaffIds.length > 0) {
      // Preserve the booked duration unless the service itself is changed.
      // A service's catalogue duration may have changed since this booking.
      const originalDuration = new Date(existing.end_time).getTime() - new Date(existing.start_time).getTime()
      const preservedEndTime = targetServiceId === existing.service_id && originalDuration > 0
        ? new Date(new Date(targetStartTime).getTime() + originalDuration).toISOString()
        : undefined
      const { endTime, service } = await validateAppointmentScheduling(
        supabase,
        {
          salon_id: targetSalonId,
          service_id: targetServiceId,
          service_ids: targetServiceId === existing.service_id ? existing.service_items?.map((item: any) => item.id) : undefined,
          start_time: targetStartTime,
          end_time: preservedEndTime,
          staff_id: targetStaffIds[0],
          staff_ids: targetStaffIds,
        },
        {
          ignoreAppointmentId: id,
          quote: targetServiceId === existing.service_id ? existing.service_items : undefined,
        }
      )

      updateData.end_time = endTime

      if (updates.service_id && updates.service_id !== existing.service_id) {
        servicePayment = planServiceChangePayment({
          appointment: existing,
          previousPriceCents: await bookedPriceCents(supabase, existing),
          priceCents: service.price_cents,
          serviceId: updates.service_id,
          packAllowedServiceIds: existing.payment_method === "pack" && existing.client_pack_id
            ? await packAllowedServiceIds(supabase, existing.client_pack_id)
            : null,
        })
        Object.assign(updateData, servicePayment.updates)
      }
    }

    if (dry_run) {
      return NextResponse.json({
        dry_run: true,
        start_time: updateData.start_time || existing.start_time,
        end_time: updateData.end_time || existing.end_time,
        staff_ids: targetStaffIds,
        payment: servicePayment,
      })
    }

    const existingAssignments: { staff_id: string }[] = existing.assignments || []

    const previousStaffIds = (existingAssignments || []).map((assignment) => assignment.staff_id)
    const normalizedStaffIdsToUpdate = staffIdsToUpdate
      ? Array.from(new Set(staffIdsToUpdate))
      : null

    if (normalizedStaffIdsToUpdate) {
      updateData.staff_id = normalizedStaffIdsToUpdate[0] || null
    }

    if (schedulingChanged) {
      const { data, error } = await supabase.rpc("admin_reschedule_appointment_atomic", {
        p_appointment_id: id,
        p_expected_updated_at: expected_updated_at || existing.updated_at || null,
        p_updates: updateData,
        p_staff_ids: targetStaffIds,
        p_payments: updates.payments || [],
      })
      if (error) {
        const status = ["23P01", "40001"].includes(error.code || "") ? 409 :
          ["42883", "PGRST202"].includes(error.code || "") ? 503 : 400
        return NextResponse.json({ error: status === 503 ? "La mise à jour du planning doit être installée avant de déplacer un rendez-vous. Aucun déplacement n’a été effectué." : error.message || "Déplacement impossible" }, { status })
      }
      return NextResponse.json({ ...presentAppointmentServices(data), ...(servicePayment ? { service_change_payment: servicePayment } : {}) })
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
        assignments:appointment_assignments(
          staff_id,
          staff:staff(id, first_name, last_name)
        ),
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

    return NextResponse.json(presentAppointmentServices(data))
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Failed to update appointment" }, { status: error.code === "SALON_HOURS" ? 400 : [400, 409, 422].includes(error.status) ? error.status : 500 })
  }
}

type SupabaseAdmin = Awaited<ReturnType<typeof createAdminClient>>

/** What the booking costs as it stands: its own prestation list when it has one, else its service. */
async function bookedPriceCents(supabase: SupabaseAdmin, appointment: { service_id?: string | null; service_items?: { price_cents?: number }[] | null }) {
  if (appointment.service_items?.length) return appointment.service_items.reduce((sum, item) => sum + (item.price_cents || 0), 0)
  if (!appointment.service_id) return 0
  const { data } = await supabase.from("services").select("price_cents").eq("id", appointment.service_id).maybeSingle()
  return data?.price_cents || 0
}

async function packAllowedServiceIds(supabase: SupabaseAdmin, clientPackId: string) {
  const { data, error } = await supabase.from("client_packs").select("pack:packs(allowed_services)").eq("id", clientPackId).maybeSingle()
  if (error) throw new Error(error.message)
  const pack = Array.isArray(data?.pack) ? data?.pack[0] : data?.pack
  return (pack?.allowed_services || []) as string[]
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist", "assistant", "therapist"])
    if ("response" in auth) {
      return auth.response
    }

    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: existing } = await supabase.from("appointments").select("id, status").eq("id", id).single()
    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }
    // Every staff member can lift a blocked slot, like they can set one; a
    // booking is only deleted by the front desk (cancelling keeps a trace).
    if (existing.status !== "blocked" && !["admin", "manager", "receptionist"].includes(auth.payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase.from("appointments").delete().eq("id", id)
    if (error) throw error

    return NextResponse.json({ message: "Appointment deleted" })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 })
  }
}
