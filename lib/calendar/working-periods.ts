import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import { resolveOpeningHoursForDate, type SalonOpeningHours, SCHEDULE_TIMEZONE } from "@/lib/calendar/scheduling"

export interface WorkingPeriod { start: Date; end: Date }
export function ceilToScheduleQuarter(date: Date) {
  const quarter = 15 * 60 * 1000
  return new Date(Math.ceil(date.getTime() / quarter) * quarter)
}
interface Shift {
  is_recurring: boolean
  day_of_week: number | null
  specific_date: string | null
  start_time: string | null
  end_time: string | null
}

export function isScheduleDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function getWorkingPeriods(date: string, openingHours: SalonOpeningHours | null | undefined, shifts: Shift[]): WorkingPeriod[] {
  if (!isScheduleDate(date)) return []
  // UTC noon gives the calendar weekday independently of the host timezone.
  const calendarDate = new Date(`${date}T12:00:00Z`)
  const day = calendarDate.getUTCDay()
  const hours = resolveOpeningHoursForDate(openingHours, calendarDate)
  if (!hours) return []
  const at = (time: string) => fromZonedTime(`${date} ${time}`, SCHEDULE_TIMEZONE)
  const salonStart = at(hours.open), salonEnd = at(hours.close)
  if (!(salonEnd > salonStart)) return []

  const specific = shifts.filter(s => !s.is_recurring && s.specific_date === date)
  const recurring = shifts.filter(s => s.is_recurring && s.day_of_week === day)
  const selected = specific.length ? specific : recurring
  // Preserve existing operation for staff with no configured weekly schedule.
  // Once a weekly schedule exists, an omitted weekday is a non-working day.
  if (!selected.length) return shifts.some(s => s.is_recurring) ? [] : [{ start: salonStart, end: salonEnd }]
  const periods = selected.flatMap(s => {
    if (!s.start_time || !s.end_time) return []
    const start = new Date(Math.max(at(s.start_time).getTime(), salonStart.getTime()))
    const end = new Date(Math.min(at(s.end_time).getTime(), salonEnd.getTime()))
    return end > start ? [{ start, end }] : []
  }).sort((a,b) => a.start.getTime() - b.start.getTime())
  const merged: WorkingPeriod[] = []
  for (const period of periods) {
    const last = merged.at(-1)
    if (last && period.start <= last.end) last.end = new Date(Math.max(last.end.getTime(), period.end.getTime()))
    else merged.push({ ...period })
  }
  return merged
}

export function intervalFitsPeriods(start: Date, end: Date, periods: WorkingPeriod[]) {
  return end > start && periods.some(period => start >= period.start && end <= period.end)
}

export function scheduleDate(instant: Date) {
  return formatInTimeZone(instant, SCHEDULE_TIMEZONE, "yyyy-MM-dd")
}
