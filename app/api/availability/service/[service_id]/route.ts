import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { addMinutes, format, parse, startOfDay, endOfDay, isWithinInterval, areIntervalsOverlapping } from "date-fns"
import { fromZonedTime } from "date-fns-tz"

const TIMEZONE = "Europe/Paris"

interface RouteContext {
  params: Promise<{ service_id: string }>
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
    const targetSalonId = salonId || service.salon_id

    // 2. Get salon hours
    const { data: salon } = await supabase
      .from("salons")
      .select("opening_hours")
      .eq("id", targetSalonId)
      .single()

    const requestedDate = fromZonedTime(dateParam, TIMEZONE)
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

    // 3. Get qualified staff
    // Find staff in this salon who are active. 
    // Ideally filter by specialty, but for now assuming all therapists in salon can do it.
    let query = supabase
      .from("staff")
      .select("id, first_name, last_name")
      .eq("salon_id", targetSalonId)
      .eq("is_active", true)
      .in("role", ["therapist", "manager", "admin"]) // Assuming managers/admins can also perform services if needed

    if (staffIdsParam) {
      const requestedIds = staffIdsParam.split(',').map(id => id.trim()).filter(Boolean)
      query = query.in("id", requestedIds)
    }

    const { data: allStaff } = await query

    if (!allStaff || allStaff.length < requiredStaffCount) {
      return NextResponse.json({
        service_id,
        date: dateParam,
        available_slots: [],
        message: `Not enough staff members available (Found: ${allStaff?.length || 0}, Required: ${requiredStaffCount})`,
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

    for (const staff of allStaff) {
      // Get shift/availability for this staff
      const { data: shifts } = await supabase
        .from("staff_availability")
        .select("*")
        .eq("staff_id", staff.id)
        .or(`and(is_recurring.eq.true,day_of_week.eq.${dayOfWeek}),and(is_recurring.eq.false,specific_date.eq.${dateParam})`)

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
         // No shift found for this day -> staff is NOT available
         // Previously we might have defaulted to salon hours, but with explicit shifts table,
         // absence of shift record usually means day off.
         // HOWEVER, since we just populated defaults, if no shift is found, it really means OFF.
         // So we should set start=end to indicate no availability.
         shiftStart = dayStart
         shiftEnd = dayStart // 0 duration
      }

      // Get existing appointments (assignments + primary staff_id legacy)
      // Check legacy column
      const { data: legacyApts } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("staff_id", staff.id)
        .in("status", ["confirmed", "pending", "blocked"])
        .gte("start_time", format(startOfDay(requestedDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))
        .lte("start_time", format(endOfDay(requestedDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))

      // Check assignments table
      const { data: assignments } = await supabase
        .from("appointment_assignments")
        .select("appointment:appointments!inner(start_time, end_time, status)")
        .eq("staff_id", staff.id)
        .in("appointment.status", ["confirmed", "pending", "blocked"])
        .gte("appointment.start_time", format(startOfDay(requestedDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))
        .lte("appointment.start_time", format(endOfDay(requestedDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))

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
    
    let currentTime = dayStart
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
      required_staff: requiredStaffCount
    })

  } catch (error: any) {
    console.error("[API] Get service availability error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
