import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { startOfDay, endOfDay, format } from "date-fns"
import { fromZonedTime } from "date-fns-tz"

const TIMEZONE = "Europe/Paris"

export async function GET(request: NextRequest) {
  try {
    const salonId = request.nextUrl.searchParams.get("salon_id")
    const staffId = request.nextUrl.searchParams.get("staff_id")
    const startDate = request.nextUrl.searchParams.get("start_date")
    const endDate = request.nextUrl.searchParams.get("end_date")
    const startHour = request.nextUrl.searchParams.get("start_hour")
    const endHour = request.nextUrl.searchParams.get("end_hour")

    const supabase = await createClient()

    // Default to last 30 days if no dates provided
    let start: Date
    let end: Date

    if (startDate) {
        start = fromZonedTime(startDate, TIMEZONE)
    } else {
        const d = fromZonedTime(new Date(), TIMEZONE)
        d.setDate(d.getDate() - 30)
        start = startOfDay(d)
    }

    if (endDate) {
        // If endDate is YYYY-MM-DD, we want the end of that day in Paris
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            end = fromZonedTime(`${endDate} 23:59:59.999`, TIMEZONE)
        } else {
            end = fromZonedTime(endDate, TIMEZONE)
        }
    } else {
        end = endOfDay(fromZonedTime(new Date(), TIMEZONE))
    }

    // Helper function to apply filters to appointment queries
    const applyFilters = (query: any) => {
      query = query
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString())

      if (salonId) query = query.eq("salon_id", salonId)
      if (staffId) query = query.eq("staff_id", staffId)

      // Apply hour filtering if specified
      if (startHour || endHour) {
        // For hour filtering, we need to extract the hour from start_time
        // This is a simplified approach - in production you might want more sophisticated time filtering
        if (startHour) {
          const startHourInt = parseInt(startHour.split(':')[0])
          // Filter appointments that start at or after the specified hour
          query = query.gte("start_time", `${format(start, 'yyyy-MM-dd')}T${startHour}:00`)
        }
        if (endHour) {
          const endHourInt = parseInt(endHour.split(':')[0])
          // Filter appointments that start before the specified end hour
          query = query.lte("start_time", `${format(end, 'yyyy-MM-dd')}T${endHour}:59`)
        }
      }

      return query
    }

    // 1. Total Appointments
    let appointmentsQuery = supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })

    appointmentsQuery = applyFilters(appointmentsQuery)
    const { count: totalAppointments } = await appointmentsQuery

    // 2. Total Clients (unique)
    let clientsQuery = supabase
      .from("appointments")
      .select("client_id")

    clientsQuery = applyFilters(clientsQuery)
    const { data: appointmentsWithClients } = await clientsQuery
    const uniqueClients = new Set(appointmentsWithClients?.map((a) => a.client_id) || [])

    // 3. Total Revenue (from appointments amount_paid_cents)
    let revenueQuery = supabase
      .from("appointments")
      .select("amount_paid_cents")

    revenueQuery = applyFilters(revenueQuery)
    const { data: revenueAppointments } = await revenueQuery
    const totalRevenueCents = revenueAppointments?.reduce((sum: number, a: { amount_paid_cents: number }) => sum + (a.amount_paid_cents || 0), 0) || 0

    // 4. Pending Bookings
    let pendingQuery = supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("start_time", new Date().toISOString())

    if (salonId) pendingQuery = pendingQuery.eq("salon_id", salonId)
    if (staffId) pendingQuery = pendingQuery.eq("staff_id", staffId)

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
    if (staffId) upcomingQuery = upcomingQuery.eq("staff_id", staffId)

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
      .in("status", ["confirmed", "pending", "completed"])

    popularServicesQuery = applyFilters(popularServicesQuery)
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

      const svcSrc = apt.services as any
      const svc: { name: string; price_cents: number } = Array.isArray(svcSrc) ? svcSrc[0] : svcSrc
      if (!svc) return

      const existing = servicesMap.get(apt.service_id)
      if (existing) {
        existing.booking_count++
        existing.revenue_cents += svc.price_cents
      } else {
        servicesMap.set(apt.service_id, {
          service_id: apt.service_id,
          service_name: svc.name,
          booking_count: 1,
          revenue_cents: svc.price_cents,
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
