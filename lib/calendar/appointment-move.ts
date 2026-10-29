import { canProvideService } from "@/lib/appointments/rules"
import { canRescheduleAppointmentStatus } from "@/lib/appointments/status"
import { assertAppointmentFitsSalonHours } from "@/lib/appointments/opening-hours"
import { canStaffTakeBookings, findOverlappingAppointment, getAppointmentStaffIds, slotDateTimeInScheduleTimezone, type CalendarAppointmentLike, type SalonOpeningHours } from "@/lib/calendar/scheduling"

export interface MovableAppointment extends CalendarAppointmentLike {
  status: string
  updated_at?: string | null
  salon_id?: string
  service_id?: string
  service?: { id?: string; name?: string } | null
  service_items?: Array<{ id: string }> | null
  client?: { first_name?: string; last_name?: string } | null
}
export interface MoveStaff {
  id: string
  salon_id?: string
  first_name?: string | null
  last_name?: string | null
  is_active?: boolean | null
  role?: string | null
  allowed_service_ids?: string[]
}
export interface MoveDestination { date: Date; hour: number; minute?: number; staffId?: string }
export interface AppointmentMove {
  appointment: MovableAppointment
  start: Date
  end: Date
  staffIds: string[]
  destination: MoveDestination
}
export function canMoveAppointment(appointment: Pick<CalendarAppointmentLike, "status">) {
  return canRescheduleAppointmentStatus(appointment.status)
}
export function appointmentMoveVersion(appointment: MovableAppointment) {
  return JSON.stringify([appointment.updated_at, appointment.start_time, appointment.end_time, appointment.status,
    appointment.salon_id, appointment.service_id, [...getAppointmentStaffIds(appointment)].sort()])
}

export function planAppointmentMove({ appointment, destination, appointments, staff, openingHours, now = Date.now() }: {
  appointment: MovableAppointment
  destination: MoveDestination
  appointments: MovableAppointment[]
  staff: MoveStaff[]
  openingHours?: SalonOpeningHours | null
  now?: number
}): AppointmentMove | null {
  if (!canMoveAppointment(appointment)) throw new Error("Seuls les rendez-vous à venir ou en attente peuvent être déplacés. Un soin commencé, effectué, annulé ou bloqué reste à sa place.")
  if (!appointment.salon_id || !(appointment.service_id || appointment.service?.id)) throw new Error("Ouvrez la fiche pour renseigner le salon et la prestation avant de déplacer ce rendez-vous.")
  const minute = destination.minute ?? 0
  if (!Number.isFinite(destination.date.getTime()) || !Number.isInteger(destination.hour) || destination.hour < 0 || destination.hour > 23 || ![0, 15, 30, 45].includes(minute)) {
    throw new Error("Choisissez un créneau valide, par quart d’heure.")
  }
  const originalIds = getAppointmentStaffIds(appointment)
  if (!originalIds.length) throw new Error("Ce rendez-vous n’a pas de masseuse affectée. Ouvrez sa fiche pour le corriger.")
  const multi = originalIds.length > 1
  if (multi && destination.staffId && !originalIds.includes(destination.staffId)) {
    throw new Error("Un rendez-vous duo conserve toute son équipe. Déposez-le dans la colonne d’une de ses masseuses, ou modifiez l’équipe dans sa fiche.")
  }
  const staffIds = multi ? originalIds : [destination.staffId || originalIds[0]]
  const start = slotDateTimeInScheduleTimezone(destination.date, destination.hour, minute)
  const duration = Date.parse(appointment.end_time) - Date.parse(appointment.start_time)
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("La durée enregistrée est invalide. Ouvrez le rendez-vous pour le corriger.")
  const end = new Date(start.getTime() + duration)
  if (start.getTime() === Date.parse(appointment.start_time) && [...staffIds].sort().join() === [...originalIds].sort().join()) return null
  if (start.getTime() < now) throw new Error("Un rendez-vous ne peut pas être déplacé dans le passé.")
  if (openingHours !== undefined) assertAppointmentFitsSalonHours(start.toISOString(), end.toISOString(), openingHours)
  const serviceIds = appointment.service_items?.length ? appointment.service_items.map(item => item.id) : [appointment.service_id || appointment.service?.id].filter(Boolean) as string[]
  for (const id of staffIds) {
    const member = staff.find(item => item.id === id)
    if (!member || !canStaffTakeBookings(member) || (appointment.salon_id && member.salon_id !== appointment.salon_id)) {
      throw new Error("La masseuse choisie n’est pas disponible dans ce salon. Actualisez le planning.")
    }
    if (!serviceIds.every(serviceId => canProvideService(member.allowed_service_ids, serviceId))) throw new Error("Cette masseuse ne peut pas réaliser toutes les prestations du rendez-vous.")
    if (findOverlappingAppointment({ appointments, staffId: id, start, end, ignoreAppointmentId: appointment.id })) {
      throw new Error("Ce créneau chevauche un autre rendez-vous ou un blocage pour au moins une masseuse de l’équipe.")
    }
  }
  return { appointment, start, end, staffIds, destination }
}
