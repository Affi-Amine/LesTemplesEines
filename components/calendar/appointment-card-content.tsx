import { formatInTimeZone } from "date-fns-tz"
import { Ban } from "lucide-react"
import { AppointmentPaymentMarker } from "@/components/calendar/appointment-payment-marker"
import { AppointmentStaffChoiceMarker } from "@/components/calendar/appointment-staff-choice-marker"
import { AppointmentServiceStars } from "@/components/calendar/appointment-service-stars"
import { getAppointmentStaffIds, isReleasedAppointment } from "@/lib/calendar/scheduling"
import { getStatusLabel } from "@/lib/utils"

/**
 * Cancelled/absent cards stay on the planning as see-through ghosts. Clicks go
 * through them to the free slot underneath (to rebook it), except on their
 * corner marker, which opens the booking.
 */
export const RELEASED_CARD_CLASS = "pointer-events-none border-dashed opacity-55 shadow-none"

// Keep short bookings readable without making their visual duration inaccurate.
export function AppointmentCardContent({ appointment, height }: { appointment: any; height: number }) {
  const blocked = appointment.status === "blocked"
  const released = isReleasedAppointment(appointment.status)
  const teamSize = getAppointmentStaffIds(appointment).length
  const duo = !blocked && (teamSize > 1 || appointment.service?.required_staff_count === 2)
  const name = blocked ? "Bloqué" : [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).join(" ") || "Client"
  const start = formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")
  const end = formatInTimeZone(appointment.end_time, "Europe/Paris", "HH:mm")
  const initials = blocked ? "B" : [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).map(value => value[0]).join("") || "C"
  const blockNote = blocked && appointment.client_notes ? ` · ${appointment.client_notes}` : ""
  if (blocked) return <div className="@container relative min-w-0 space-y-0.5 leading-4" title={`${start}–${end} · ${name}${blockNote}`}>
    <div className="flex min-w-0 flex-wrap items-center gap-0.5 text-[8px] font-semibold @min-[38px]:text-[10px] @min-[100px]:text-xs">
      <span className="shrink-0 tabular-nums"><span className="@min-[20px]:hidden" aria-hidden="true">{start.slice(0, 2)}<br />{start.slice(2)}</span><span className="hidden @min-[20px]:inline">{start}</span></span>
      {height < 48 && <span className="hidden min-w-0 truncate @min-[90px]:inline">{name}</span>}
    </div>
    {height >= 48 && <p className="truncate text-[10px] font-semibold @min-[100px]:text-xs"><span className="@min-[45px]:hidden" aria-hidden="true">{initials}</span><span className="hidden @min-[45px]:inline">{name}</span></p>}
    {height >= 84 && appointment.client_notes && <p className="hidden text-[10px] leading-3.5 opacity-85 @min-[65px]:block @min-[100px]:text-[11px]"><span className="line-clamp-2">{appointment.client_notes}</span></p>}
    {height >= 110 && <p className="hidden text-[11px] opacity-80 @min-[100px]:block">Fin à {end}</p>}
    <span className="sr-only">{name} · {start}–{end}{blockNote}</span>
  </div>
  const presence = appointment.status === "in_progress" ? "Arrivé" : appointment.status === "completed" ? "Effectué"
    : released ? getStatusLabel(appointment.status) : "Attendu"
  return <div className="@container relative min-w-0 space-y-0.5 leading-4" title={`${start}–${end} · ${name} · ${appointment.service?.name || "Massage"} · ${presence}`}>
    <div data-appointment-markers className={`flex min-w-0 items-center gap-0.5 ${height < 44 ? "flex-nowrap" : "flex-wrap"}`}>
    <AppointmentPaymentMarker appointment={appointment} inline />
    <AppointmentServiceStars appointment={appointment} />
    <AppointmentStaffChoiceMarker appointment={appointment} />
    {duo && <span data-duo-marker title="Massage duo · même rendez-vous dans les deux colonnes" aria-label="Massage duo, rendez-vous lié à deux masseuses"
      className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[#382304] bg-[#e7bc65] px-0.5 text-[10px] font-black leading-none text-[#382304]">×2</span>}
    {released && <span data-released-marker title={`${getStatusLabel(appointment.status)} — voir le détail`}
      className="pointer-events-auto inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-current bg-white/80">
      <Ban aria-hidden="true" className="h-2.5 w-2.5" />
    </span>}
    {height < 44 && <span className="min-w-0 flex-1 truncate text-right text-[9px] font-semibold tabular-nums">{start}</span>}
    </div>
    {height >= 44 && <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold leading-3.5 @min-[100px]:text-xs">
      <span className="shrink-0 tabular-nums">{start}</span>
      {height < 64 && <span className={`min-w-0 truncate ${released ? "line-through" : ""}`}>{name}</span>}
      {height >= 110 && <span className="hidden truncate font-normal opacity-80 @min-[100px]:inline">– {end}</span>}
    </div>}
    {height >= 64 && <p className={`truncate text-[11px] font-semibold leading-3.5 @min-[100px]:text-xs ${released ? "line-through" : ""}`}><span className="@min-[45px]:hidden" aria-hidden="true">{initials}</span><span className="hidden @min-[45px]:inline">{name}</span></p>}
    {height >= 84 && <p data-care-state={appointment.status} className="truncate text-[10px] font-semibold leading-3.5">{presence}</p>}
    {height >= 84 && !released && <p className="hidden text-[10px] leading-3.5 opacity-85 @min-[65px]:block @min-[100px]:text-[11px]"><span className={height >= 110 ? "line-clamp-2" : "block truncate"}>{appointment.service?.name || "Massage"}</span></p>}
    <span className="sr-only">{name} · {start}–{end} · {presence}</span>
  </div>
}
