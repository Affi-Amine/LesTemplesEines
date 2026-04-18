export const runtime = "nodejs"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendAppointmentBookedEmails } from "@/lib/email/notifications"
import { ClientDataSchema, createBookableAppointment } from "@/lib/appointments/create"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { fromZonedTime } from "date-fns-tz"

const AppointmentSchema = z.object({
  salon_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  client_data: ClientDataSchema.optional(),
  staff_id: z.string().uuid().optional(),
  staff_ids: z.array(z.string().uuid()).optional(),
  service_id: z.string().uuid().optional(),
  start_time: z.string(),
  end_time: z.string().optional(),
  client_notes: z.string().optional(),
  notes: z.string().optional(), // Alternative field name
  status: z.enum(["confirmed", "in_progress", "completed", "cancelled", "no_show", "blocked"]).optional(),
  payment_status: z.enum(["pending", "paid", "unpaid", "failed", "partial"]).optional(),
  payment_method: z.string().optional(),
  amount_paid_cents: z.number().int().min(0).optional(),
  paid_at: z.string().optional(),
  client_pack_id: z.string().uuid().optional(),
}).refine((data) => data.status === "blocked" || data.client_id || data.client_data, {
  message: "Either client_id or client_data must be provided (unless status is blocked)",
}).refine((data) => data.status === "blocked" || data.service_id, {
  message: "Service ID is required (unless status is blocked)",
}).refine((data) => data.staff_id || (data.staff_ids && data.staff_ids.length > 0), {
  message: "At least one staff member must be assigned",
})

export async function GET(request: NextRequest) {
  try {
    const salonId = request.nextUrl.searchParams.get("salon_id")
    const staffId = request.nextUrl.searchParams.get("staff_id")
    const clientId = request.nextUrl.searchParams.get("client_id")
    const startDate = request.nextUrl.searchParams.get("start_date")
    const endDate = request.nextUrl.searchParams.get("end_date")
    const status = request.nextUrl.searchParams.get("status")

    // Helper to validate UUID
    const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    if (salonId && !isValidUUID(salonId)) return NextResponse.json([])
    if (staffId && !isValidUUID(staffId)) return NextResponse.json([])
    if (clientId && !isValidUUID(clientId)) return NextResponse.json([])

    const supabase = await createAdminClient()

    let query = supabase.from("appointments").select(
      `*,
        client:clients(*),
        staff:staff(id, first_name, last_name, role, phone),
        assignments:appointment_assignments(
          staff:staff(id, first_name, last_name)
        ),
        service:services(*),
        salon:salons(id, name, city, address)`,
    )

    if (salonId) query = query.eq("salon_id", salonId)
    if (staffId) query = query.eq("staff_id", staffId)
    if (clientId) query = query.eq("client_id", clientId)
    
    if (startDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        const start = fromZonedTime(startDate, "Europe/Paris")
        query = query.gte("start_time", start.toISOString())
      } else {
        query = query.gte("start_time", startDate)
      }
    }

    if (endDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        const end = fromZonedTime(`${endDate} 23:59:59.999`, "Europe/Paris")
        query = query.lte("start_time", end.toISOString())
      } else {
        query = query.lte("start_time", endDate)
      }
    }
    if (status) query = query.eq("status", status)

    // Order by start_time descending (most recent first)
    query = query.order("start_time", { ascending: false })

    const { data: appointments, error } = await query

    if (error) throw error

    return NextResponse.json(appointments || [])
  } catch (error) {
    console.error("[v0] Get appointments error:", error)
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const appointmentData = AppointmentSchema.parse(body)

    const supabase = await createAdminClient()

    if (appointmentData.status !== "blocked") {
      const appointment = await createBookableAppointment(supabase, {
        salon_id: appointmentData.salon_id,
        client_id: appointmentData.client_id,
        client_data: appointmentData.client_data,
        staff_id: appointmentData.staff_id,
        staff_ids: appointmentData.staff_ids,
        service_id: appointmentData.service_id!,
        start_time: appointmentData.start_time,
        end_time: appointmentData.end_time,
        client_notes: appointmentData.client_notes,
        notes: appointmentData.notes,
        status: appointmentData.status,
        payment_status: appointmentData.payment_status || "unpaid",
        payment_method: appointmentData.payment_method || "on_site",
        amount_paid_cents: appointmentData.amount_paid_cents || 0,
        paid_at: appointmentData.paid_at,
        client_pack_id: appointmentData.client_pack_id,
      })

      try {
        await sendAppointmentBookedEmails(appointment)
      } catch (emailError) {
        console.error("[appointments] Failed to send confirmation emails:", emailError)
      }

      return NextResponse.json(appointment, { status: 201 })
    }

    let clientId = appointmentData.client_id

    // If client_data is provided instead of client_id, create or find client
    if (appointmentData.client_data && !clientId) {
      // Check if client already exists by phone
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("phone", appointmentData.client_data.phone)
        .single()

      if (existingClient) {
        clientId = existingClient.id
      } else {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert([appointmentData.client_data])
          .select("id")
          .single()

        if (clientError) throw new Error("Failed to create client: " + clientError.message)

        clientId = newClient.id

        // Create loyalty points record
        await supabase.from("loyalty_points").insert([
          {
            client_id: newClient.id,
            points_balance: 0,
            total_earned: 0,
            total_redeemed: 0,
          },
        ])
      }
    }

    if (!clientId && appointmentData.status !== "blocked") {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 })
    }

    // Calculate end_time if not provided
    let endTime = appointmentData.end_time
    if (!endTime) {
      if (!appointmentData.service_id) {
        return NextResponse.json({ error: "End time is required when no service is specified" }, { status: 400 })
      }

      // Get service duration
      const { data: service } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", appointmentData.service_id)
        .single()

      if (service) {
        const startDate = new Date(appointmentData.start_time)
        const endDate = new Date(startDate.getTime() + service.duration_minutes * 60000)
        endTime = endDate.toISOString()
      } else {
        return NextResponse.json({ error: "Service not found" }, { status: 404 })
      }
    }

    if (appointmentData.service_id) {
      const { data: serviceSalon, error: serviceSalonError } = await supabase
        .from("service_salons")
        .select("service_id")
        .eq("service_id", appointmentData.service_id)
        .eq("salon_id", appointmentData.salon_id)
        .maybeSingle()

      if (serviceSalonError) {
        throw serviceSalonError
      }

      if (!serviceSalon) {
        return NextResponse.json({ error: "Ce service n'est pas disponible dans le salon sélectionné" }, { status: 400 })
      }
    }

    // Check for conflicts
    const primaryStaffId = appointmentData.staff_id
    const allStaffIds = appointmentData.staff_ids || (primaryStaffId ? [primaryStaffId] : [])

    for (const staffId of allStaffIds) {
      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id")
        .eq("staff_id", staffId) // Check legacy single staff column
        .in("status", ["confirmed", "pending", "blocked"]) // Include blocked status in conflict check
        .lt("start_time", endTime) // Overlap check: StartA < EndB AND EndA > StartB
        .gt("end_time", appointmentData.start_time)

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({ error: "Un ou plusieurs créneaux ne sont plus disponibles" }, { status: 409 })
      }
      
      // Also check multi-provider assignments table
      const { data: assignmentConflicts } = await supabase
        .from("appointment_assignments")
        .select("appointment_id")
        .eq("staff_id", staffId)
        .not("appointment_id", "is", null) // assignment must link to valid apt
      
      if (assignmentConflicts && assignmentConflicts.length > 0) {
         // Deep check on those appointments times would be better, but simplified for now:
         // Real check requires joining appointments table on assignmentConflicts.
         // Let's do a proper join check:
         const { data: deepConflicts } = await supabase
           .from("appointment_assignments")
           .select("appointment:appointments!inner(start_time, end_time, status)")
           .eq("staff_id", staffId)
           .filter("appointment.status", "in", '("confirmed","pending","blocked")')
           .filter("appointment.start_time", "lt", endTime)
           .filter("appointment.end_time", "gt", appointmentData.start_time)
           
         if (deepConflicts && deepConflicts.length > 0) {
            return NextResponse.json({ error: "Un ou plusieurs créneaux ne sont plus disponibles" }, { status: 409 })
         }
      }
    }

    // Create appointment
    const appointmentPayload = {
      salon_id: appointmentData.salon_id,
      client_id: clientId,
      staff_id: primaryStaffId || allStaffIds[0], // Set primary for backward compat
      service_id: appointmentData.service_id,
      start_time: appointmentData.start_time,
      end_time: endTime,
      client_notes: appointmentData.client_notes || appointmentData.notes,
      status: appointmentData.status || "confirmed",
      payment_status: appointmentData.payment_status || null,
      payment_method: appointmentData.payment_method || null,
      amount_paid_cents: appointmentData.amount_paid_cents || 0,
      paid_at: appointmentData.paid_at || null,
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert([appointmentPayload])
      .select(
        `*,
        client:clients(*),
        staff:staff(id, first_name, last_name, role, phone),
        service:services(*),
        salon:salons(id, name, city, address)`,
      )
      .single()

    if (error) throw error

    // Insert multi-provider assignments
    if (allStaffIds.length > 0) {
      const assignments = allStaffIds.map(sid => ({
        appointment_id: appointment.id,
        staff_id: sid
      }))
      
      const { error: assignError } = await supabase
        .from("appointment_assignments")
        .insert(assignments)
      
      if (assignError) {
        console.error("Failed to assign extra staff", assignError)
        // Non-fatal, but logged
      }
    }


    // Fire booking emails (client + admin). Errors are logged but do not fail the request.
    try {
      console.log("[email] Triggering booking emails for appointment:", appointment.id)
      await sendAppointmentBookedEmails(appointment)
      console.log("[email] Booking emails dispatched for:", appointment.id)
    } catch (emailError) {
      console.error("[email] Error sending booking emails:", emailError)
    }

    return NextResponse.json(appointment, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create appointment error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Failed to create appointment" }, { status: 500 })
  }
}
