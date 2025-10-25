import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { startOfDay, endOfDay } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const salonId = request.nextUrl.searchParams.get("salon_id")
    const startDate = request.nextUrl.searchParams.get("start_date")
    const endDate = request.nextUrl.searchParams.get("end_date")

    const supabase = await createClient()

    // Default to current month if no dates provided
    const start = startDate ? new Date(startDate) : startOfDay(new Date(new Date().setDate(1)))
    const end = endDate ? new Date(endDate) : endOfDay(new Date())

    // Build base query filters
    const appointmentFilters = {
      ...(salonId && { salon_id: salonId }),
      start_time: { gte: start.toISOString(), lte: end.toISOString() },
    }

    // 1. Total Appointments
    let appointmentsQuery = supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())

    if (salonId) appointmentsQuery = appointmentsQuery.eq("salon_id", salonId)

    const { count: totalAppointments } = await appointmentsQuery

    // 2. Total Clients (unique)
    let clientsQuery = supabase
      .from("appointments")
      .select("client_id")
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())

    if (salonId) clientsQuery = clientsQuery.eq("salon_id", salonId)

    const { data: appointmentsWithClients } = await clientsQuery
    const uniqueClients = new Set(appointmentsWithClients?.map((a) => a.client_id) || [])

    // 3. Total Revenue (from payments)
    let paymentsQuery = supabase
      .from("payments")
      .select("amount_cents")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())

    if (salonId) {
      // Join with appointments to filter by salon
      paymentsQuery = supabase
        .from("payments")
        .select("amount_cents, appointments!inner(salon_id)")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())

      if (salonId) {
        paymentsQuery = paymentsQuery.eq("appointments.salon_id", salonId)
      }
    }

    const { data: payments } = await paymentsQuery
    const totalRevenueCents = payments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0

    // 4. Pending Bookings
    let pendingQuery = supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("start_time", new Date().toISOString())

    if (salonId) pendingQuery = pendingQuery.eq("salon_id", salonId)

    const { count: pendingBookings } = await pendingQuery

    // 5. Upcoming Appointments (next 7 days)
    const next7Days = new Date()
    next7Days.setDate(next7Days.getDate() + 7)

    let upcomingQuery = supabase
      .from("appointments")
      .select(
        `
        id,
        start_time,
        end_time,
        status,
        client:clients(first_name, last_name, phone),
        service:services(name, duration_minutes, price_cents),
        staff:staff(first_name, last_name),
        salon:salons(name, city)
      `
      )
      .gte("start_time", new Date().toISOString())
      .lte("start_time", next7Days.toISOString())
      .in("status", ["confirmed", "pending"])
      .order("start_time", { ascending: true })
      .limit(10)

    if (salonId) upcomingQuery = upcomingQuery.eq("salon_id", salonId)

    const { data: upcomingAppointments } = await upcomingQuery

    // 6. Popular Services
    let popularServicesQuery = supabase
      .from("appointments")
      .select(
        `
        service_id,
        services(name, price_cents)
      `
      )
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .eq("status", "completed")

    if (salonId) popularServicesQuery = popularServicesQuery.eq("salon_id", salonId)

    const { data: serviceAppointments } = await popularServicesQuery

    // Count and aggregate services
    const servicesMap = new Map<
      string,
      {
        service_id: string
        service_name: string
        booking_count: number
        revenue_cents: number
      }
    >()

    serviceAppointments?.forEach((apt) => {
      if (!apt.service_id || !apt.services) return

      const existing = servicesMap.get(apt.service_id)
      if (existing) {
        existing.booking_count++
        existing.revenue_cents += apt.services.price_cents
      } else {
        servicesMap.set(apt.service_id, {
          service_id: apt.service_id,
          service_name: apt.services.name,
          booking_count: 1,
          revenue_cents: apt.services.price_cents,
        })
      }
    })

    const popularServices = Array.from(servicesMap.values())
      .sort((a, b) => b.booking_count - a.booking_count)
      .slice(0, 5)

    // Return dashboard data
    return NextResponse.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      kpis: {
        total_appointments: totalAppointments || 0,
        total_clients: uniqueClients.size,
        total_revenue_cents: totalRevenueCents,
        pending_bookings: pendingBookings || 0,
      },
      upcoming_appointments: upcomingAppointments || [],
      popular_services: popularServices,
    })
  } catch (error) {
    console.error("[v0] Dashboard analytics error:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard analytics" }, { status: 500 })
  }
}
