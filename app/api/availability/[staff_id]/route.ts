import {
  getTodayInParis,
  isDateBeforeTodayInParis,
  resolveStaffIdsThatCanProvideService,
} from "@/lib/appointments/create"
import { BLOCKING_APPOINTMENT_STATUSES } from "@/lib/appointments/status"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveOpeningHoursForDate } from "@/lib/calendar/scheduling"
import { type NextRequest, NextResponse } from "next/server"
import { addMinutes } from "date-fns"
import { fromZonedTime } from "date-fns-tz"
import { canStaffTakeBookings } from "@/lib/calendar/scheduling"
import { ceilToScheduleQuarter, getWorkingPeriods, isScheduleDate } from "@/lib/calendar/working-periods"

const TIMEZONE = "Europe/Paris"

interface RouteContext {
  params: Promise<{ staff_id: string }>
}

function ceilToNextQuarter(date: Date) {
  return ceilToScheduleQuarter(date)
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { staff_id } = await context.params
    const dateParam = request.nextUrl.searchParams.get("date") // YYYY-MM-DD
    const serviceId = request.nextUrl.searchParams.get("service_id")

    if (!dateParam) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }
    if (!isScheduleDate(dateParam)) return NextResponse.json({ error: "Date invalide" }, { status: 400 })

    if (isDateBeforeTodayInParis(dateParam)) {
      return NextResponse.json({
        staff_id,
        date: dateParam,
        available_slots: [],
        total_slots: 0,
        message: "Cannot book appointments in the past",
      })
    }

    const supabase = await createAdminClient()

    // Get staff member
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, salon_id, first_name, last_name, role, is_active")
      .eq("id", staff_id)
      .eq("is_active", true)
      .single()

    if (staffError || !staff || !canStaffTakeBookings(staff)) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    // Get service duration if provided
    let serviceDuration = 60 // Default 60 minutes
    if (serviceId) {
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("duration_minutes, is_active, required_staff_count")
        .eq("id", serviceId)
        .single()

      if (serviceError || !service || service.is_active !== true) return NextResponse.json({ error: "Prestation introuvable ou désactivée" }, { status: 404 })
      serviceDuration = service.duration_minutes
      const { data: link, error: linkError } = await supabase.from("service_salons").select("service_id")
        .eq("service_id", serviceId).eq("salon_id", staff.salon_id)
      if (linkError) throw linkError
      if (!link?.length) return NextResponse.json({ error: "Soin indisponible dans ce salon" }, { status: 400 })

      const qualifiedStaffIds = await resolveStaffIdsThatCanProvideService(supabase, [staff_id], serviceId)

      if (!qualifiedStaffIds.includes(staff_id)) {
        return NextResponse.json({
          staff_id,
          staff_name: `${staff.first_name} ${staff.last_name}`,
          date: dateParam,
          service_duration_minutes: serviceDuration,
          salon_hours: null,
          available_slots: [],
          total_slots: 0,
          message: "Staff member is not qualified for this service",
        })
      }
    }

    // Get salon opening hours
    const { data: salon, error: salonError } = await supabase
      .from("salons")
      .select("opening_hours, is_active")
      .eq("id", staff.salon_id)
      .single()

    if (salonError) {
      throw salonError
    }
    if (!salon || salon.is_active !== true) return NextResponse.json({ error: "Salon indisponible" }, { status: 404 })

    // Parse date
    const requestedDate = fromZonedTime(`${dateParam} 12:00:00`, TIMEZONE)
    const dayOfWeek = new Date(`${dateParam}T12:00:00Z`).getUTCDay()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const dayName = dayNames[dayOfWeek]

    // Get salon hours for this day
    const salonHours = resolveOpeningHoursForDate(salon?.opening_hours, requestedDate)
    if (!salonHours) {
      return NextResponse.json({
        staff_id,
        date: dateParam,
        available_slots: [],
        message: "Salon is closed on this day",
      })
    }

    // Get staff availability for this date
    // Check both recurring (day_of_week) and specific dates
    const { data: staffAvailability, error: staffAvailabilityError } = await supabase
      .from("staff_availability")
      .select("*")
      .eq("staff_id", staff_id)

    if (staffAvailabilityError) {
      throw staffAvailabilityError
    }

    const availabilityPeriods = getWorkingPeriods(dateParam, salon?.opening_hours, staffAvailability || [])

    // Get existing appointments for this staff member on this date
    // Use Paris-based day start/end
    const dayStart = fromZonedTime(`${dateParam} 00:00:00`, TIMEZONE).toISOString()
    const dayEnd = fromZonedTime(`${dateParam} 23:59:59.999`, TIMEZONE).toISOString()

    // Query both legacy staff_id and assignments table
    const { data: primaryAppointments, error: primaryAppointmentsError } = await supabase
      .from("appointments")
      .select("start_time, end_time, status")
      .eq("staff_id", staff_id)
      .lt("start_time", dayEnd)
      .gt("end_time", dayStart)
      .in("status", BLOCKING_APPOINTMENT_STATUSES)

    if (primaryAppointmentsError) {
      throw primaryAppointmentsError
    }

    // Get assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from("appointment_assignments")
      .select("appointment:appointments!inner(start_time, end_time, status)")
      .eq("staff_id", staff_id)
      .lt("appointment.start_time", dayEnd)
      .gt("appointment.end_time", dayStart)
      .filter("appointment.status", "in", `(${BLOCKING_APPOINTMENT_STATUSES.map((status) => `"${status}"`).join(",")})`)

    if (assignmentsError) {
      throw assignmentsError
    }

    // Combine
    const existingAppointments = [
      ...(primaryAppointments || []),
      ...(assignments?.map((a: any) => a.appointment) || [])
    ]

    const todayInParis = getTodayInParis()
    const isTodayInParis = dateParam === todayInParis
    const now = new Date()

    // Generate time slots (every 15 minutes)
    const slotInterval = 15 // minutes
    const availableSlots: Array<{ start: string; end: string; available_staff: string[] }> = []

    for (const period of availabilityPeriods) {
        const periodStart = period.start
        const periodEnd = period.end

      let currentSlot = periodStart

      if (isTodayInParis && currentSlot < now) {
        currentSlot = ceilToNextQuarter(now)
      }

      while (currentSlot < periodEnd) {
        const slotEnd = addMinutes(currentSlot, serviceDuration)

        // Check if slot end is within availability period
        if (slotEnd > periodEnd) break

        // Check if slot conflicts with existing appointments
        const hasConflict = existingAppointments?.some((apt) => {
          const aptStart = new Date(apt.start_time)
          const aptEnd = new Date(apt.end_time)

          return currentSlot < aptEnd && slotEnd > aptStart
        })

        if (!hasConflict) {
          availableSlots.push({
            start: currentSlot.toISOString(),
            end: slotEnd.toISOString(),
            available_staff: [staff_id],
          })
        }

        // Move to next slot
        currentSlot = addMinutes(currentSlot, slotInterval)
      }
    }

    return NextResponse.json({
      staff_id,
      staff_name: `${staff.first_name} ${staff.last_name}`,
      date: dateParam,
      service_duration_minutes: serviceDuration,
      salon_hours: salonHours,
      available_slots: availableSlots,
      total_slots: availableSlots.length,
    })
  } catch (error) {
    console.error("[v0] Get availability error:", error)
    return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 })
  }
}
