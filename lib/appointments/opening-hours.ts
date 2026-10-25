import { formatInTimeZone } from "date-fns-tz"
import { getWorkingPeriods, intervalFitsPeriods } from "@/lib/calendar/working-periods"
import { resolveOpeningHoursForDate, SCHEDULE_TIMEZONE, type SalonOpeningHours } from "@/lib/calendar/scheduling"

export class SalonHoursError extends Error {
  readonly code = "SALON_HOURS"
}

export function assertAppointmentFitsSalonHours(startTime: string, endTime: string, openingHours: SalonOpeningHours | null | undefined) {
  const start = new Date(startTime), end = new Date(endTime)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new SalonHoursError("Les horaires du rendez-vous sont invalides.")
  }
  const date = formatInTimeZone(start, SCHEDULE_TIMEZONE, "yyyy-MM-dd")
  const hours = resolveOpeningHoursForDate(openingHours, start)
  if (!hours) throw new SalonHoursError("Le salon est fermé ce jour. Choisissez une autre date.")
  if (!intervalFitsPeriods(start, end, getWorkingPeriods(date, openingHours, []))) {
    throw new SalonHoursError(`Le rendez-vous doit se dérouler entièrement entre ${hours.open} et ${hours.close}, heure de Paris. Choisissez un autre créneau.`)
  }
}
