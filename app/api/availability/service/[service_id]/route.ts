import { createAdminClient } from "@/lib/supabase/admin"
import {
  getTodayInParis,
  isDateBeforeTodayInParis,
  resolveStaffIdsThatCanProvideService,
} from "@/lib/appointments/create"
import { BLOCKING_APPOINTMENT_STATUSES } from "@/lib/appointments/status"
import { type NextRequest, NextResponse } from "next/server"
import { addMinutes, format, areIntervalsOverlapping } from "date-fns"
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz"

const TIMEZONE = "Europe/Paris"

interface RouteContext {
  params: Promise<{ service_id: string }>
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
    const { service_id } = await context.params
    const dateParam = request.nextUrl.searchParams.get("date") // YYYY-MM-DD
    const salonId = request.nextUrl.searchParams.get("salon_id")
    const staffIdsParam = request.nextUrl.searchParams.get("staff_ids") // Comma separated IDs

    if (!dateParam) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }

    if (isDateBeforeTodayInParis(dateParam)) {
      return NextResponse.json({
        service_id,
        date: dateParam,
        available_slots: [],
        required_staff: 0,
        total_slots: 0,
        message: "Cannot book appointments in the past",
      })
    }

    const supabase = await createAdminClient()

    // 1. Get service details
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("*")
      .eq("id", service_id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    const duration = service.duration_minutes
    const requiredStaffCount = service.required_staff_count || 1
    const targetSalonId = salonId

    if (!targetSalonId) {
      return NextResponse.json({ error: "salon_id is required for multi-salon services" }, { status: 400 })
    }

    const { data: serviceSalon, error: serviceSalonError } = await supabase
      .from("service_salons")
      .select("service_id")
      .eq("service_id", service_id)
      .eq("salon_id", targetSalonId)
      .maybeSingle()

    if (serviceSalonError) throw serviceSalonError

    if (!serviceSalon) {
      return NextResponse.json({
        service_id,
        date: dateParam,
        available_slots: [],
        message: "Service is not available in this salon",
      })
    }

    // 2. Get salon hours
    const { data: salon, error: salonError } = await supabase
      .from("salons")
      .select("opening_hours")
      .eq("id", targetSalonId)
      .single()

    if (salonError) {
      throw salonError
    }

    const requestedDate = fromZonedTime(`${dateParam} 12:00:00`, TIMEZONE)
    const dayOfWeek = requestedDate.getDay()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const dayName = dayNames[dayOfWeek]
    const salonHours = salon?.opening_hours?.[dayName]

    if (!salonHours) {
      return NextResponse.json({
        service_id,
        date: dateParam,
        available_slots: [],
        message: "Salon is closed on this day",
      })
    }

    // 3. Get staff in this salon, then filter by explicit service authorization if configured.
    let query = supabase
      .from("staff")
      .select("id, first_name, last_name")
      .eq("salon_id", targetSalonId)
      .eq("is_active", true)
      .in("role", ["therapist", "manager", "admin"])

    if (staffIdsParam) {
      const requestedIds = staffIdsParam.split(',').map(id => id.trim()).filter(Boolean)
      query = query.in("id", requestedIds)
    }

    const { data: staffInSalon } = await query

    if (!staffInSalon || staffInSalon.length === 0) {
      return NextResponse.json({
        service_id,
        date: dateParam,
        available_slots: [],
        message: "No active staff available in this salon",
      })
    }

    const qualifiedStaffIds = await resolveStaffIdsThatCanProvideService(
      supabase,
      staffInSalon.map((member) => member.id),
      service_id
    )
    const allStaff = staffInSalon.filter((member) => qualifiedStaffIds.includes(member.id))

    if (!allStaff || allStaff.length < requiredStaffCount) {
      return NextResponse.json({
        service_id,
        date: dateParam,
        available_slots: [],
        message: `Not enough qualified staff members available (Found: ${allStaff?.length || 0}, Required: ${requiredStaffCount})`,
      })
    }

    // If specific staff requested, ensure we have enough of them
    if (staffIdsParam && allStaff.length < requiredStaffCount) {
       // This might happen if requested staff are inactive or not found
       // But assuming the user selects from active staff, this check is redundant but safe
    }

    // 4. Calculate availability for each staff member
    const staffAvailabilityMap = new Map<string, { busy: Array<{start: Date, end: Date}>, shift: {start: Date, end: Date} }>()

    const dayStart = fromZonedTime(`${dateParam} ${salonHours.open}:00`, TIMEZONE)
    const dayEnd = fromZonedTime(`${dateParam} ${salonHours.close}:00`, TIMEZONE)

    const dayRangeStart = fromZonedTime(`${dateParam} 00:00:00`, TIMEZONE).toISOString()
    const dayRangeEnd = fromZonedTime(`${dateParam} 23:59:59.999`, TIMEZONE).toISOString()

    for (const staff of allStaff) {
      // Get shift/availability for this staff
      const { data: shifts, error: shiftsError } = await supabase
        .from("staff_availability")
        .select("*")
        .eq("staff_id", staff.id)
        .or(`and(is_recurring.eq.true,day_of_week.eq.${dayOfWeek}),and(is_recurring.eq.false,specific_date.eq.${dateParam})`)

      if (shiftsError) {
        throw shiftsError
      }

      let shiftStart = dayStart
      let shiftEnd = dayEnd

      if (shifts && shifts.length > 0) {
        // Use the specific date override if exists, otherwise recurring
        const specific = shifts.find(s => !s.is_recurring)
        const recurring = shifts.find(s => s.is_recurring)
        const activeShift = specific || recurring

        if (activeShift) {
           if (activeShift.start_time) shiftStart = fromZonedTime(`${dateParam} ${activeShift.start_time}`, TIMEZONE)
           if (activeShift.end_time) shiftEnd = fromZonedTime(`${dateParam} ${activeShift.end_time}`, TIMEZONE)
        }
      } else {
         // Keep the same fallback as the single-staff availability route:
         // if no staff_availability row exists, assume salon opening hours.
         shiftStart = dayStart
         shiftEnd = dayEnd
      }

      // Get existing appointments (assignments + primary staff_id legacy)
      // Check legacy column
      const { data: legacyApts, error: legacyAptsError } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("staff_id", staff.id)
        .in("status", BLOCKING_APPOINTMENT_STATUSES)
        .gte("start_time", dayRangeStart)
        .lte("start_time", dayRangeEnd)

      if (legacyAptsError) {
        throw legacyAptsError
      }

      // Check assignments table
      const { data: assignments, error: assignmentsError } = await supabase
        .from("appointment_assignments")
        .select("appointment:appointments!inner(start_time, end_time, status)")
        .eq("staff_id", staff.id)
        .filter("appointment.status", "in", `(${BLOCKING_APPOINTMENT_STATUSES.map((status) => `"${status}"`).join(",")})`)
        .gte("appointment.start_time", dayRangeStart)
        .lte("appointment.start_time", dayRangeEnd)

      if (assignmentsError) {
        throw assignmentsError
      }

      const busyRanges: Array<{start: Date, end: Date}> = []
      
      legacyApts?.forEach(apt => {
        busyRanges.push({ start: new Date(apt.start_time), end: new Date(apt.end_time) })
      })
      
      assignments?.forEach((a: any) => {
        if (a.appointment) {
          busyRanges.push({ start: new Date(a.appointment.start_time), end: new Date(a.appointment.end_time) })
        }
      })

      staffAvailabilityMap.set(staff.id, { busy: busyRanges, shift: { start: shiftStart, end: shiftEnd } })
    }

    // 5. Find intersection slots
    const availableSlots: Array<{start: string, end: string, available_staff: string[]}> = []
    
    const todayInParis = getTodayInParis()
    const isTodayInParis = dateParam === todayInParis
    const nowInParis = toZonedTime(new Date(), TIMEZONE)

    let currentTime = dayStart
    if (isTodayInParis && currentTime < nowInParis) {
      currentTime = ceilToNextQuarter(nowInParis)
    }
    // Step by 15 minutes (or 30?)
    const stepMinutes = 15

    while (currentTime.getTime() + duration * 60000 <= dayEnd.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60000)
      const slotInterval = { start: currentTime, end: slotEnd }

      // Check which staff are free for this entire interval
      const availableStaffIds: string[] = []
      const staffStatus: any = {}

      for (const staff of allStaff) {
        const staffData = staffAvailabilityMap.get(staff.id)
        if (!staffData) {
            staffStatus[staff.id] = "No data"
            continue
        }

        const { busy: busyRanges, shift } = staffData
        
        // Check if within working hours
        const isWithinShift = areIntervalsOverlapping(slotInterval, shift) && 
                              slotInterval.start >= shift.start && 
                              slotInterval.end <= shift.end

        if (!isWithinShift) {
            staffStatus[`${staff.first_name} ${staff.last_name}`] = `Outside shift (${format(shift.start, 'HH:mm')}-${format(shift.end, 'HH:mm')})`
            continue
        }

        // Check if overlaps with any busy range
        const isBusy = busyRanges.some(busy => areIntervalsOverlapping(slotInterval, busy))
        
        if (!isBusy) {
          availableStaffIds.push(staff.id)
          staffStatus[`${staff.first_name} ${staff.last_name}`] = "Available"
        } else {
          // Find which appointment is blocking
          const blockingApt = busyRanges.find(busy => areIntervalsOverlapping(slotInterval, busy))
          const blockReason = blockingApt ? `Busy (${format(blockingApt.start, 'HH:mm')}-${format(blockingApt.end, 'HH:mm')})` : "Busy"
          staffStatus[`${staff.first_name} ${staff.last_name}`] = blockReason
        }
      }

      if (availableStaffIds.length >= requiredStaffCount) {
        availableSlots.push({
          start: currentTime.toISOString(),
          end: slotEnd.toISOString(),
          available_staff: availableStaffIds
        })
      }

      currentTime = addMinutes(currentTime, stepMinutes)
    }

    return NextResponse.json({
      service_id,
      date: dateParam,
      available_slots: availableSlots,
      required_staff: requiredStaffCount,
      salon_hours: salonHours,
      total_slots: availableSlots.length,
      service_duration_minutes: duration,
    })

  } catch (error: any) {
    console.error("[API] Get service availability error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
