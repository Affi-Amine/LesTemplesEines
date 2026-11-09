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
export type AppointmentMoveMode = "strict" | "salon-admin"
export interface AppointmentMove {
  appointment: MovableAppointment
  start: Date
  end: Date
  staffIds: string[]
  destination: MoveDestination
  mode: AppointmentMoveMode
  warnings: string[]
  requestId?: string
}
export function canMoveAppointment(appointment: Pick<CalendarAppointmentLike, "status">, mode: AppointmentMoveMode = "strict") {
  return canRescheduleAppointmentStatus(appointment.status) || appointment.status === "blocked"
    || (mode === "salon-admin" && (appointment.status === "in_progress" || appointment.status === "completed"))
}
export function appointmentMoveVersion(appointment: MovableAppointment) {
  return JSON.stringify([appointment.updated_at, appointment.start_time, appointment.end_time, appointment.status,
    appointment.salon_id, appointment.service_id, [...getAppointmentStaffIds(appointment)].sort()])
}

export function planAppointmentMove({ appointment, destination, appointments, staff, openingHours, now = Date.now(), mode = "strict" }: {
  appointment: MovableAppointment
  destination: MoveDestination
  appointments: MovableAppointment[]
  staff: MoveStaff[]
  openingHours?: SalonOpeningHours | null
  now?: number
  mode?: AppointmentMoveMode
}): AppointmentMove | null {
  if (!canMoveAppointment(appointment, mode)) throw new Error(mode === "salon-admin"
    ? "Les rendez-vous annulés ou les clients absents restent dans l’historique et ne peuvent pas être déplacés."
    : "Seuls les rendez-vous à venir ou en attente et les créneaux bloqués peuvent être déplacés. Un soin commencé, effectué ou annulé reste à sa place.")
  if (!appointment.salon_id || !(appointment.status === "blocked" || appointment.service_id || appointment.service?.id)) throw new Error("Ouvrez la fiche pour renseigner le salon et la prestation avant de déplacer ce rendez-vous.")
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
  if (!Number.isFinite(end.getTime())) throw new Error("La durée enregistrée est invalide. Ouvrez le rendez-vous pour le corriger.")
  if (start.getTime() === Date.parse(appointment.start_time) && [...staffIds].sort().join() === [...originalIds].sort().join()) return null
  const warnings: string[] = []
  const allowException = (message: string, strictMessage = message) => {
    if (mode !== "salon-admin") throw new Error(strictMessage)
    warnings.push(message)
  }
  if (start.getTime() < now) allowException("Le nouvel horaire se situe dans le passé.", "Un rendez-vous ne peut pas être déplacé dans le passé.")
  if (openingHours !== undefined) {
    try { assertAppointmentFitsSalonHours(start.toISOString(), end.toISOString(), openingHours) }
    catch (error) {
      if (mode !== "salon-admin") throw error
      warnings.push("Le nouveau créneau se situe en dehors des horaires d’ouverture du salon.")
    }
  }
  const serviceIds = appointment.service_items?.length ? appointment.service_items.map(item => item.id) : [appointment.service_id || appointment.service?.id].filter(Boolean) as string[]
  for (const id of staffIds) {
    const member = staff.find(item => item.id === id)
    if (!member || !canStaffTakeBookings(member) || (appointment.salon_id && member.salon_id !== appointment.salon_id)) {
      throw new Error("La masseuse choisie n’est pas disponible dans ce salon. Actualisez le planning.")
    }
    const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || "Cette masseuse"
    if (!serviceIds.every(serviceId => canProvideService(member.allowed_service_ids, serviceId))) allowException(`${name} n’est pas habilitée à toutes les prestations du rendez-vous.`, "Cette masseuse ne peut pas réaliser toutes les prestations du rendez-vous.")
    if (findOverlappingAppointment({ appointments, staffId: id, start, end, ignoreAppointmentId: appointment.id })) {
      allowException(`Ce créneau chevauche un autre rendez-vous ou un blocage pour ${name}.`, "Ce créneau chevauche un autre rendez-vous ou un blocage pour au moins une masseuse de l’équipe.")
    }
  }
  return { appointment, start, end, staffIds, destination, mode, warnings: [...new Set(warnings)] }
}
