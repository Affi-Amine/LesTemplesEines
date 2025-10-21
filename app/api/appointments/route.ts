import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const AppointmentSchema = z.object({
  salon_id: z.string().uuid(),
  client_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  client_notes: z.string().optional(),
  status: z.enum(["confirmed", "pending", "completed", "cancelled", "no_show"]).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const salonId = request.nextUrl.searchParams.get("salon_id")
    const staffId = request.nextUrl.searchParams.get("staff_id")
    const clientId = request.nextUrl.searchParams.get("client_id")
    const startDate = request.nextUrl.searchParams.get("start_date")
    const endDate = request.nextUrl.searchParams.get("end_date")

    const supabase = await createClient()

    let query = supabase.from("appointments").select(
      `*,
        client:clients(*),
        staff:staff(*),
        service:services(*),
        salon:salons(*)`,
    )

    if (salonId) query = query.eq("salon_id", salonId)
    if (staffId) query = query.eq("staff_id", staffId)
    if (clientId) query = query.eq("client_id", clientId)
    if (startDate) query = query.gte("start_time", startDate)
    if (endDate) query = query.lte("start_time", endDate)

    const { data: appointments, error } = await query

    if (error) throw error

    return NextResponse.json(appointments)
  } catch (error) {
    console.error("[v0] Get appointments error:", error)
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const appointmentData = AppointmentSchema.parse(body)

    const supabase = await createClient()

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from("appointments")
      .select("*")
      .eq("staff_id", appointmentData.staff_id)
      .eq("status", "confirmed")
      .gte("start_time", appointmentData.start_time)
      .lt("start_time", appointmentData.end_time)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: "Time slot is not available" }, { status: 409 })
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert([{ ...appointmentData, status: "confirmed" }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(appointment, { status: 201 })
  } catch (error) {
    console.error("[v0] Create appointment error:", error)
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 })
  }
}
