import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { fromZonedTime } from "date-fns-tz"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist", "assistant", "therapist"])
    if ("response" in auth) {
      return auth.response
    }

    const { id: staffId } = await params
    const canViewOtherStaff = ["admin", "manager", "receptionist"].includes(auth.payload.role)

    if (!canViewOtherStaff && auth.payload.staffId !== staffId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    const startDate = request.nextUrl.searchParams.get("start_date")
    const endDate = request.nextUrl.searchParams.get("end_date")
    const status = request.nextUrl.searchParams.get("status")

    if (!staffId) {
      return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    
    // 1. Get appointments where staff is primary
    const { data: primaryApts, error: primaryError } = await supabase
      .from("appointments")
      .select(
        `*,
        client:clients(*),
        staff:staff(id, first_name, last_name, role, phone),
        service:services(*),
        salon:salons(id, name, city, address)`
      )
      .eq("staff_id", staffId)
      .order("start_time", { ascending: true })

    if (primaryError) throw primaryError

    // 2. Get appointments where staff is assigned (secondary)
    const { data: assignments, error: assignError } = await supabase
      .from("appointment_assignments")
      .select("appointment_id")
      .eq("staff_id", staffId)
    
    if (assignError) throw assignError

    let secondaryApts: any[] = []
    if (assignments && assignments.length > 0) {
      const aptIds = assignments.map(a => a.appointment_id)
      const { data: secondary, error: secError } = await supabase
        .from("appointments")
        .select(
          `*,
          client:clients(*),
          staff:staff(id, first_name, last_name, role, phone),
          service:services(*),
          salon:salons(id, name, city, address)`
        )
        .in("id", aptIds)
        .order("start_time", { ascending: true })
      
      if (secError) throw secError
      secondaryApts = secondary || []
    }

    // Merge and deduplicate (just in case)
    const allApts = [...(primaryApts || []), ...secondaryApts]
    // Filter duplicates by ID
    const uniqueApts = Array.from(new Map(allApts.map(item => [item.id, item])).values())
    
    // Apply date/status filters in memory (since we split the query)
    // or re-query with OR? OR is harder with joins in Supabase sometimes.
    // In-memory is fine for reasonable dataset sizes per staff.
    
    let filteredApts = uniqueApts

    if (startDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          const start = fromZonedTime(startDate, "Europe/Paris").toISOString()
          filteredApts = filteredApts.filter(a => a.start_time >= start)
      } else {
          filteredApts = filteredApts.filter(a => a.start_time >= startDate)
      }
    }
    if (endDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          const end = fromZonedTime(`${endDate} 23:59:59.999`, "Europe/Paris").toISOString()
          filteredApts = filteredApts.filter(a => a.start_time <= end)
      } else {
          filteredApts = filteredApts.filter(a => a.start_time <= endDate)
      }
    }
    if (status) {
      filteredApts = filteredApts.filter(a => a.status === status)
    }
    
    // Sort again
    filteredApts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    return NextResponse.json(filteredApts)
  } catch (error) {
    console.error("[staff:appointments] error:", error)
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
