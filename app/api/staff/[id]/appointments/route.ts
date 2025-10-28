import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("=== Staff Appointments API Called ===")
    const { id: staffId } = await params
    console.log("Staff ID:", staffId)
    
    const startDate = request.nextUrl.searchParams.get("start_date")
    const endDate = request.nextUrl.searchParams.get("end_date")
    const status = request.nextUrl.searchParams.get("status")
    
    console.log("Filters:", { startDate, endDate, status })

    if (!staffId) {
      console.log("ERROR: No staff ID provided")
      return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
    }

    console.log("Creating Supabase admin client...")
    const supabase = createAdminClient()
    console.log("Admin client created successfully")

    console.log("Building query...")
    let query = supabase.from("appointments").select(
      `*,
        clients:client_id(*),
        staff:staff_id(id, first_name, last_name, role, phone),
        services:service_id(*),
        salons:salon_id(id, name, city, address)`
    ).eq("staff_id", staffId)

    // Apply optional filters
    if (startDate) query = query.gte("start_time", startDate)
    if (endDate) query = query.lte("start_time", endDate)
    if (status) query = query.eq("status", status)

    // Order by start time
    query = query.order("start_time", { ascending: true })

    console.log("Executing query...")
    const { data: appointments, error } = await query

    if (error) {
      console.error("Supabase query error:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      return NextResponse.json({ error: "Failed to fetch appointments", details: error }, { status: 500 })
    }

    console.log("Query successful! Found", appointments?.length || 0, "appointments")
    console.log("Appointments data:", JSON.stringify(appointments, null, 2))
    
    return NextResponse.json(appointments)
  } catch (error) {
    console.error("Catch block error:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}