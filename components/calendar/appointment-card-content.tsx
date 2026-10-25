import { formatInTimeZone } from "date-fns-tz"
import { AppointmentPaymentMarker } from "@/components/calendar/appointment-payment-marker"
import { getAppointmentStaffIds } from "@/lib/calendar/scheduling"

// Keep short bookings readable without making their visual duration inaccurate.
export function AppointmentCardContent({ appointment, height }: { appointment: any; height: number }) {
  const blocked = appointment.status === "blocked"
  const teamSize = getAppointmentStaffIds(appointment).length
  const name = blocked ? "Bloqué" : [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).join(" ") || "Client"
  const start = formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")
  const end = formatInTimeZone(appointment.end_time, "Europe/Paris", "HH:mm")
  const initials = blocked ? "B" : [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).map(value => value[0]).join("") || "C"
  const paid = appointment.payment_status === "paid" && !blocked
  return <div className="@container relative min-w-0 space-y-0.5 leading-4" title={`${start}–${end} · ${name}${blocked ? "" : ` · ${appointment.service?.name || "Massage"}`}`}>
    <AppointmentPaymentMarker appointment={appointment} />
    <div className={`${paid && height < 40 ? "hidden @min-[64px]:flex" : "flex"} min-w-0 items-center gap-0.5 text-[8px] font-semibold @min-[38px]:text-[10px] @min-[100px]:text-xs ${paid ? "pt-3.5 @min-[64px]:pt-0" : ""}`}>
      <span className={`shrink-0 tabular-nums ${paid ? "@min-[64px]:pr-4" : ""}`}><span className="@min-[20px]:hidden" aria-hidden="true">{start.slice(0, 2)}<br />{start.slice(2)}</span><span className="hidden @min-[20px]:inline">{start}</span></span>
      {height < 48 && <span className="hidden min-w-0 truncate @min-[90px]:inline">{name}</span>}
      {teamSize > 1 && <span className="hidden shrink-0 rounded bg-black/10 px-1 text-[10px] @min-[100px]:inline">×{teamSize}</span>}
    </div>
    {height >= 48 && <p className={`${paid && height < 68 ? "hidden @min-[64px]:block" : ""} truncate text-[10px] font-semibold @min-[100px]:text-xs`}><span className="@min-[45px]:hidden" aria-hidden="true">{initials}</span><span className="hidden @min-[45px]:inline">{name}</span></p>}
    {height >= 84 && !blocked && <p className="hidden text-[10px] leading-3.5 opacity-85 @min-[65px]:block @min-[100px]:text-[11px]"><span className="line-clamp-2">{appointment.service?.name || "Massage"}</span></p>}
    {height >= 110 && <p className="hidden text-[11px] opacity-80 @min-[100px]:block">Fin à {end}</p>}
    <span className="sr-only">{name} · {start}–{end}</span>
  </div>
}
