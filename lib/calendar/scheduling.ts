import { blocksAppointmentSchedule } from "@/lib/appointments/status"

export const QUARTER_MINUTES = 15
export const DEFAULT_SCHEDULE_START_HOUR = 8
export const DEFAULT_SCHEDULE_END_HOUR = 20
export const BOOKABLE_STAFF_ROLES = ["therapist", "assistant", "manager", "admin"] as const
export const DEFAULT_OPENING_HOURS: SalonOpeningHours = {
  monday: { open: "10:00", close: "20:00" },
  tuesday: { open: "10:00", close: "20:00" },
  wednesday: { open: "10:00", close: "20:00" },
  thursday: { open: "10:00", close: "20:00" },
  friday: { open: "10:00", close: "20:00" },
  saturday: { open: "09:00", close: "21:00" },
  sunday: { open: "10:00", close: "19:00" },
}

export type SalonOpeningHours = Record<string, { open: string; close: string }>
export type BookableStaffRole = (typeof BOOKABLE_STAFF_ROLES)[number]

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

export function canStaffTakeBookings(staff: { is_active?: boolean | null; role?: string | null }) {
  return Boolean(staff.is_active && staff.role && BOOKABLE_STAFF_ROLES.includes(staff.role as BookableStaffRole))
}

export interface CalendarAppointmentLike {
  id: string
  start_time: string
  end_time: string
  status?: string | null
  staff_id?: string | null
  staff?: { id?: string | null } | null
  assignments?: Array<{ staff_id?: string | null; staff?: { id?: string | null } | null }> | null
}

interface OverlapParams {
  appointments: CalendarAppointmentLike[]
  staffId: string
  start: Date
  end: Date
  ignoreAppointmentId?: string
}

export function isQuarterAligned(minute: number): boolean {
  return minute % QUARTER_MINUTES === 0
}

export function snapMinuteToQuarter(minute: number): number {
  const clamped = Math.max(0, Math.min(59, minute))
  return Math.floor(clamped / QUARTER_MINUTES) * QUARTER_MINUTES
}

export function toQuarterTimeOptions(startHour: number, endHour: number): string[] {
  const values: string[] = []
  for (let hour = startHour; hour <= endHour; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      values.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
    }
  }
  return values
}

export function quarterOptionsBetween(startTime: string, endTime: string): string[] {
  const [startHour, startMinute] = startTime.split(":").map((value) => Number.parseInt(value, 10))
  const [endHour, endMinute] = endTime.split(":").map((value) => Number.parseInt(value, 10))

  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) {
    return []
  }

  const values: string[] = []
  let currentMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute

  while (currentMinutes < endMinutes) {
    const hour = Math.floor(currentMinutes / 60)
    const minute = currentMinutes % 60
    values.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
    currentMinutes += QUARTER_MINUTES
  }

  return values
}

export function getOpeningHoursForDate(openingHours: SalonOpeningHours | null | undefined, date: Date) {
  return openingHours?.[DAY_KEYS[date.getDay()]]
}

export function resolveOpeningHoursForDate(openingHours: SalonOpeningHours | null | undefined, date: Date) {
  if (!openingHours || Object.keys(openingHours).length === 0) {
    return DEFAULT_OPENING_HOURS[DAY_KEYS[date.getDay()]]
  }

  return getOpeningHoursForDate(openingHours, date)
}

export function timeToMinutes(time: string): number | null {
  const [hour, minute] = time.split(":").map((value) => Number.parseInt(value, 10))
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }
  return hour * 60 + minute
}

export function minutesToTimeLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
}

export function getScheduleHourRange(
  openingHours: SalonOpeningHours | null | undefined,
  date: Date,
  fallbackStartHour = DEFAULT_SCHEDULE_START_HOUR,
  fallbackEndHour = DEFAULT_SCHEDULE_END_HOUR
): number[] {
  const dayHours = resolveOpeningHoursForDate(openingHours, date)
  if (openingHours && !dayHours) {
    return []
  }

  const openMinutes = dayHours ? timeToMinutes(dayHours.open) : null
  const closeMinutes = dayHours ? timeToMinutes(dayHours.close) : null

  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
    return Array.from({ length: fallbackEndHour - fallbackStartHour }, (_, index) => fallbackStartHour + index)
  }

  const startHour = Math.floor(openMinutes / 60)
  const endHourExclusive = Math.ceil(closeMinutes / 60)
  return Array.from({ length: Math.max(0, endHourExclusive - startHour) }, (_, index) => startHour + index)
}

export function getDefaultStartTimeForDate(openingHours: SalonOpeningHours | null | undefined, date: Date): string {
  return resolveOpeningHoursForDate(openingHours, date)?.open || "09:00"
}

export function getAppointmentDurationMinutes(appointment: Pick<CalendarAppointmentLike, "start_time" | "end_time">): number {
  const start = new Date(appointment.start_time)
  const end = new Date(appointment.end_time)
  return Math.max(QUARTER_MINUTES, Math.round((end.getTime() - start.getTime()) / (1000 * 60)))
}

export function getAppointmentStaffIds(appointment: CalendarAppointmentLike): string[] {
  const ids = new Set<string>()
  if (appointment.staff_id) {
    ids.add(appointment.staff_id)
  }
  if (appointment.staff?.id) {
    ids.add(appointment.staff.id)
  }
  appointment.assignments?.forEach((assignment) => {
    if (assignment.staff_id) {
      ids.add(assignment.staff_id)
    }
    if (assignment.staff?.id) {
      ids.add(assignment.staff.id)
    }
  })
  return Array.from(ids)
}

export function getStaffDisplayName(staff: { first_name?: string | null; last_name?: string | null }): string {
  const firstName = staff.first_name?.trim()
  if (firstName) {
    return firstName
  }

  return staff.last_name?.trim() || "Prestataire"
}

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA
}

export function findOverlappingAppointment({
  appointments,
  staffId,
  start,
  end,
  ignoreAppointmentId,
}: OverlapParams): CalendarAppointmentLike | null {
  for (const appointment of appointments) {
    if (ignoreAppointmentId && appointment.id === ignoreAppointmentId) {
      continue
    }
    if (!blocksAppointmentSchedule(appointment.status)) {
      continue
    }
    const staffIds = getAppointmentStaffIds(appointment)
    if (!staffIds.includes(staffId)) {
      continue
    }

    const existingStart = new Date(appointment.start_time)
    const existingEnd = new Date(appointment.end_time)
    if (rangesOverlap(start, end, existingStart, existingEnd)) {
      return appointment
    }
  }

  return null
}
