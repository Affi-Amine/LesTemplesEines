import { formatInTimeZone } from "date-fns-tz"

export const MANAGEMENT_TIMEZONE = "Europe/Paris"
export const MANAGEMENT_RULE = "Modification et annulation possibles jusqu’à la veille à 23 h 59, heure de Paris."
export const MANAGEMENT_DAY_BLOCKED = "Pour modifier ou annuler votre rendez-vous aujourd’hui, contactez directement le salon."
export const MANAGEMENT_REFUND = "Pour toute demande de remboursement, veuillez contacter le salon."

export function managementDate(instant: Date | string) {
  return formatInTimeZone(instant, MANAGEMENT_TIMEZONE, "yyyy-MM-dd")
}

export function managementPermission(appointment: { status: string; start_time: string }, now = new Date()) {
  if (appointment.status === "cancelled") return { allowed: false, reason: "Ce rendez-vous est annulé." }
  if (!["confirmed", "pending"].includes(appointment.status)) return { allowed: false, reason: "Ce rendez-vous ne peut plus être modifié en ligne. Contactez le salon." }
  const day = managementDate(appointment.start_time), today = managementDate(now)
  if (day === today) return { allowed: false, reason: MANAGEMENT_DAY_BLOCKED }
  if (day < today) return { allowed: false, reason: "Ce rendez-vous est passé. Contactez le salon pour toute demande." }
  return { allowed: true, reason: "" }
}

export interface ManagedAppointment {
  id: string
  version: string
  status: string
  start_time: string
  end_time: string
  client_name: string
  service_name: string
  duration_minutes: number
  price_cents: number
  staff_names: string[]
  payment_status: string
  payment_method: string | null
  amount_paid_cents: number
  salon: { name: string; address: string; city: string; phone: string | null; email: string | null }
  permission: { allowed: boolean; reason: string }
  tomorrow: string
}
