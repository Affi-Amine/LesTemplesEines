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

const TIMEZONE = "Europe/Paris"

interface RouteContext {
  params: Promise<{ staff_id: string }>
}

function ceilToNextQuarter(date: Date) {
  const rounded = new Date(date)
  rounded.setSeconds(0, 0)

  const minutes = rounded.getMinutes()
  const remainder = minutes % 15

  if (remainder !== 0) {
    rounded.setMinutes(minutes + (15 - remainder))
  }

  return rounded
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { staff_id } = await context.params
    const dateParam = request.nextUrl.searchParams.get("date") // YYYY-MM-DD
    const serviceId = request.nextUrl.searchParams.get("service_id")

    if (!dateParam) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }

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
      .select("id, salon_id, first_name, last_name")
      .eq("id", staff_id)
      .eq("is_active", true)
      .single()

    if (staffError || !staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    // Get service duration if provided
    let serviceDuration = 60 // Default 60 minutes
    if (serviceId) {
      const { data: service } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", serviceId)
        .single()

      if (service) {
        serviceDuration = service.duration_minutes
      }

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
      .select("opening_hours")
      .eq("id", staff.salon_id)
      .single()

    if (salonError) {
      throw salonError
    }

    // Parse date
    const requestedDate = fromZonedTime(`${dateParam} 12:00:00`, TIMEZONE)
    const dayOfWeek = requestedDate.getDay() // 0 = Sunday, 6 = Saturday
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
      .or(`and(is_recurring.eq.true,day_of_week.eq.${dayOfWeek}),and(is_recurring.eq.false,specific_date.eq.${dateParam})`)

    if (staffAvailabilityError) {
      throw staffAvailabilityError
    }

    // If no availability set, assume available during salon hours
    let availabilityPeriods: Array<{ start: string; end: string }> = []

    if (!staffAvailability || staffAvailability.length === 0) {
      // Default to salon hours
      availabilityPeriods = [
        {
          start: salonHours.open,
          end: salonHours.close,
        },
      ]
    } else {
      // Use staff availability
      availabilityPeriods = staffAvailability.map((av) => ({
        start: av.start_time || salonHours.open,
        end: av.end_time || salonHours.close,
      }))
    }

    // Get existing appointments for this staff member on this date
    // Use Paris-based day start/end
    const dayStart = fromZonedTime(`${dateParam} 00:00:00`, TIMEZONE).toISOString()
    const dayEnd = fromZonedTime(`${dateParam} 23:59:59.999`, TIMEZONE).toISOString()

    // Query both legacy staff_id and assignments table
    const { data: primaryAppointments, error: primaryAppointmentsError } = await supabase
      .from("appointments")
      .select("start_time, end_time, status")
      .eq("staff_id", staff_id)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .in("status", BLOCKING_APPOINTMENT_STATUSES)

    if (primaryAppointmentsError) {
      throw primaryAppointmentsError
    }

    // Get assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from("appointment_assignments")
      .select("appointment:appointments!inner(start_time, end_time, status)")
      .eq("staff_id", staff_id)
      .gte("appointment.start_time", dayStart)
      .lte("appointment.start_time", dayEnd)
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
        // Ensure time format is correct (HH:mm or HH:mm:ss)
        const cleanStart = period.start.split(':').slice(0, 2).join(':')
        const cleanEnd = period.end.split(':').slice(0, 2).join(':')
        
        // Parse availability times
        const periodStart = fromZonedTime(`${dateParam} ${cleanStart}:00`, TIMEZONE)
        const periodEnd = fromZonedTime(`${dateParam} ${cleanEnd}:00`, TIMEZONE)

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
