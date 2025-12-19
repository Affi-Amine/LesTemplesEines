import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { addMinutes, format, parse, startOfDay, endOfDay, isWithinInterval } from "date-fns"
import { fromZonedTime } from "date-fns-tz"

const TIMEZONE = "Europe/Paris"

interface RouteContext {
  params: Promise<{ staff_id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { staff_id } = await context.params
    const dateParam = request.nextUrl.searchParams.get("date") // YYYY-MM-DD
    const serviceId = request.nextUrl.searchParams.get("service_id")

    if (!dateParam) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }

    const supabase = await createClient()

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
    }

    // Get salon opening hours
    const { data: salon } = await supabase
      .from("salons")
      .select("opening_hours")
      .eq("id", staff.salon_id)
      .single()

    // Parse date
    const requestedDate = fromZonedTime(dateParam, TIMEZONE)
    const dayOfWeek = requestedDate.getDay() // 0 = Sunday, 6 = Saturday
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const dayName = dayNames[dayOfWeek]

    // Get salon hours for this day
    const salonHours = salon?.opening_hours?.[dayName]
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
    const { data: staffAvailability } = await supabase
      .from("staff_availability")
      .select("*")
      .eq("staff_id", staff_id)
      .or(`and(is_recurring.eq.true,day_of_week.eq.${dayOfWeek}),and(is_recurring.eq.false,specific_date.eq.${dateParam})`)

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
    const { data: primaryAppointments } = await supabase
      .from("appointments")
      .select("start_time, end_time, status")
      .eq("staff_id", staff_id)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .neq("status", "cancelled")
      .neq("status", "no_show")

    // Get assignments
    const { data: assignments } = await supabase
      .from("appointment_assignments")
      .select("appointment:appointments!inner(start_time, end_time, status)")
      .eq("staff_id", staff_id)
      .gte("appointment.start_time", dayStart)
      .lte("appointment.start_time", dayEnd)
      .neq("appointment.status", "cancelled")
      .neq("appointment.status", "no_show")

    // Combine
    const existingAppointments = [
      ...(primaryAppointments || []),
      ...(assignments?.map((a: any) => a.appointment) || [])
    ]

    // Generate time slots (every 30 minutes)
    const slotInterval = 30 // minutes
    const availableSlots: Array<{ start: string; end: string }> = []

    for (const period of availabilityPeriods) {
        // Ensure time format is correct (HH:mm or HH:mm:ss)
        const cleanStart = period.start.split(':').slice(0, 2).join(':')
        const cleanEnd = period.end.split(':').slice(0, 2).join(':')
        
        // Parse availability times
        const periodStart = fromZonedTime(`${dateParam} ${cleanStart}:00`, TIMEZONE)
        const periodEnd = fromZonedTime(`${dateParam} ${cleanEnd}:00`, TIMEZONE)

      let currentSlot = periodStart

      while (currentSlot < periodEnd) {
        const slotEnd = addMinutes(currentSlot, serviceDuration)

        // Check if slot end is within availability period
        if (slotEnd > periodEnd) break

        // Check if slot conflicts with existing appointments
        const hasConflict = existingAppointments?.some((apt) => {
          const aptStart = new Date(apt.start_time)
          const aptEnd = new Date(apt.end_time)

          // Check if there's any overlap
          return (
            (currentSlot >= aptStart && currentSlot < aptEnd) ||
            (slotEnd > aptStart && slotEnd <= aptEnd) ||
            (currentSlot <= aptStart && slotEnd >= aptEnd)
          )
        })

        if (!hasConflict) {
          availableSlots.push({
            start: currentSlot.toISOString(),
            end: slotEnd.toISOString(),
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
