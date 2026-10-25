import { resolveOpeningHoursForDate, timeToMinutes, type SalonOpeningHours } from "@/lib/calendar/scheduling"

export function isCalendarQuarterOpen(hour: number, minute: number, date: Date, openingHours?: SalonOpeningHours | null) {
  if (openingHours === undefined) return true
  const hours = resolveOpeningHoursForDate(openingHours, date)
  const open = hours ? timeToMinutes(hours.open) : null, close = hours ? timeToMinutes(hours.close) : null
  return open !== null && close !== null && hour * 60 + minute >= open && hour * 60 + minute + 15 <= close
}

export function CalendarHourLabel({ hour, date, openingHours }: { hour: number; date: Date; openingHours?: SalonOpeningHours | null }) {
  const hours = openingHours === undefined ? undefined : resolveOpeningHoursForDate(openingHours, date)
  const open = hours ? timeToMinutes(hours.open) : null, close = hours ? timeToMinutes(hours.close) : null
  const closed = openingHours !== undefined && (open === null || close === null || hour * 60 >= close || (hour + 1) * 60 <= open)
  return <div className="relative h-full">
    <span>{String(hour).padStart(2, "0")}:00</span>
    {closed && <span className="block text-[8px] font-normal">Fermé</span>}
    {hours && [hours.open, hours.close].map((time, index) => {
      const minutes = timeToMinutes(time)
      if (minutes === null || minutes <= hour * 60 || minutes >= (hour + 1) * 60) return null
      return <span key={index} data-hours-boundary={index ? "close" : "open"} title={`${index ? "Fermeture" : "Ouverture"} à ${time}`}
        className="absolute right-0 text-[9px] font-bold" style={{ top: `${(minutes - hour * 60) / 60 * 100}%` }}>{time}</span>
    })}
  </div>
}

export function CalendarClosedHours({ hour, date, openingHours }: { hour: number; date: Date; openingHours?: SalonOpeningHours | null }) {
  if (openingHours === undefined) return null
  const hours = resolveOpeningHoursForDate(openingHours, date)
  const open = hours ? timeToMinutes(hours.open) : null
  const close = hours ? timeToMinutes(hours.close) : null
  const start = hour * 60, end = start + 60
  const ranges = open === null || close === null || close <= open ? [[0, 60]] : [
    [0, Math.max(0, Math.min(60, open - start))],
    [Math.max(0, Math.min(60, close - start)), 60],
  ]
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    {ranges.filter(([from, to]) => to > from).map(([from, to], index) => <div key={index} data-closed-period
      className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,rgba(125,137,130,0.18)_0,rgba(125,137,130,0.18)_6px,rgba(125,137,130,0.32)_6px,rgba(125,137,130,0.32)_8px)]"
      style={{ top: `${from / 60 * 100}%`, height: `${(to - from) / 60 * 100}%` }} />)}
    {close !== null && close > start && close < end && <div className="absolute inset-x-0 border-t border-dashed border-muted-foreground/70" style={{ top: `${(close - start) / 60 * 100}%` }} />}
  </div>
}
