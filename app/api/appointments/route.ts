import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const ClientDataSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().regex(/^\+?[0-9]{10,}/),
  email: z.string().email().optional(),
})

const AppointmentSchema = z.object({
  salon_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  client_data: ClientDataSchema.optional(),
  staff_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: z.string(),
  end_time: z.string().optional(),
  client_notes: z.string().optional(),
  notes: z.string().optional(), // Alternative field name
  status: z.enum(["confirmed", "pending", "in_progress", "completed", "cancelled", "no_show"]).optional(),
}).refine((data) => data.client_id || data.client_data, {
  message: "Either client_id or client_data must be provided",
})

export async function GET(request: NextRequest) {
  try {
    const salonId = request.nextUrl.searchParams.get("salon_id")
    const staffId = request.nextUrl.searchParams.get("staff_id")
    const clientId = request.nextUrl.searchParams.get("client_id")
    const startDate = request.nextUrl.searchParams.get("start_date")
    const endDate = request.nextUrl.searchParams.get("end_date")
    const status = request.nextUrl.searchParams.get("status")

    const supabase = await createAdminClient()

    let query = supabase.from("appointments").select(
      `*,
        client:clients(*),
        staff:staff(id, first_name, last_name, role, phone),
        service:services(*),
        salon:salons(id, name, city, address)`,
    )

    if (salonId) query = query.eq("salon_id", salonId)
    if (staffId) query = query.eq("staff_id", staffId)
    if (clientId) query = query.eq("client_id", clientId)
    if (startDate) query = query.gte("start_time", startDate)
    if (endDate) query = query.lte("start_time", endDate)
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

    if (!clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 })
    }

    // Calculate end_time if not provided
    let endTime = appointmentData.end_time
    if (!endTime) {
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

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from("appointments")
      .select("*")
      .eq("staff_id", appointmentData.staff_id)
      .in("status", ["confirmed", "pending"])
      .gte("start_time", appointmentData.start_time)
      .lt("start_time", endTime)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: "Ce créneau n'est plus disponible" }, { status: 409 })
    }

    // Create appointment
    const appointmentPayload = {
      salon_id: appointmentData.salon_id,
      client_id: clientId,
      staff_id: appointmentData.staff_id,
      service_id: appointmentData.service_id,
      start_time: appointmentData.start_time,
      end_time: endTime,
      client_notes: appointmentData.client_notes || appointmentData.notes,
      status: appointmentData.status || "confirmed",
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

    return NextResponse.json(appointment, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create appointment error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Failed to create appointment" }, { status: 500 })
  }
}
