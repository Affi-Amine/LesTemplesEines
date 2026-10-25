import { formatInTimeZone } from "date-fns-tz"
import { AppointmentPaymentBadge } from "@/components/appointment-payment-badge"
import { getAppointmentStaffIds } from "@/lib/calendar/scheduling"

// Keep short bookings readable without making their visual duration inaccurate.
export function AppointmentCardContent({ appointment, height }: { appointment: any; height: number }) {
  const blocked = appointment.status === "blocked"
  const teamSize = getAppointmentStaffIds(appointment).length
  const name = blocked ? "Bloqué" : [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).join(" ") || "Client"
  const start = formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")
  const end = formatInTimeZone(appointment.end_time, "Europe/Paris", "HH:mm")
  const initials = blocked ? "B" : [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).map(value => value[0]).join("") || "C"
  return <div className="@container min-w-0 space-y-0.5 leading-4" title={`${start}–${end} · ${name}${blocked ? "" : ` · ${appointment.service?.name || "Massage"}`}`}>
    <div className="flex min-w-0 items-center gap-0.5 text-[8px] font-semibold @min-[38px]:text-[10px] @min-[100px]:text-xs">
      <span className="shrink-0 tabular-nums">{start}</span>
      {height < 48 && <span className="hidden min-w-0 truncate @min-[90px]:inline">{name}</span>}
      <span className="ml-auto hidden shrink-0 @min-[64px]:inline-flex"><AppointmentPaymentBadge appointment={appointment} compact iconOnly /></span>
      {teamSize > 1 && <span className="hidden shrink-0 rounded bg-black/10 px-1 text-[10px] @min-[100px]:inline">×{teamSize}</span>}
    </div>
    {height >= 48 && <p className="truncate text-[10px] font-semibold @min-[100px]:text-xs"><span className="@min-[45px]:hidden" aria-hidden="true">{initials}</span><span className="hidden @min-[45px]:inline">{name}</span></p>}
    {height >= 84 && !blocked && <p className="hidden text-[10px] leading-3.5 opacity-85 @min-[65px]:block @min-[100px]:text-[11px]"><span className="line-clamp-2">{appointment.service?.name || "Massage"}</span></p>}
    {height >= 110 && <p className="hidden text-[11px] opacity-80 @min-[100px]:block">Fin à {end}</p>}
    <span className="sr-only">{name} · Jusqu’à {end}</span>
  </div>
}
