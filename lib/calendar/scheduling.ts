import { blocksAppointmentSchedule } from "@/lib/appointments/status"

export const QUARTER_MINUTES = 15

export interface CalendarAppointmentLike {
  id: string
  start_time: string
  end_time: string
  status?: string | null
  staff_id?: string | null
  staff?: { id?: string | null } | null
  assignments?: Array<{ staff?: { id?: string | null } | null }> | null
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
    if (assignment.staff?.id) {
      ids.add(assignment.staff.id)
    }
  })
  return Array.from(ids)
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
