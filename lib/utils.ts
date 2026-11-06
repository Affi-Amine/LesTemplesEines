import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Centralized appointment status utilities
export type AppointmentStatus = "confirmed" | "pending" | "in_progress" | "completed" | "cancelled" | "no_show" | "blocked"

export function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed":
      return "appointment-tone appointment-tone-blue bg-blue-100 text-blue-950 border-blue-200"
    case "pending":
      return "appointment-tone appointment-tone-red bg-rose-100 text-rose-950 border-rose-200"
    case "in_progress":
    case "completed":
      return "appointment-tone appointment-tone-blue bg-blue-100 text-blue-950 border-blue-200"
    case "cancelled":
      return "appointment-tone appointment-tone-red bg-rose-100 text-rose-950 border-rose-200"
    case "no_show":
      return "appointment-tone appointment-tone-red bg-rose-100 text-rose-950 border-rose-200"
    case "blocked":
      return "appointment-tone appointment-tone-blocked bg-slate-200 text-slate-900 border-slate-300"
    default:
      return "appointment-tone appointment-tone-blocked bg-slate-200 text-slate-900 border-slate-300"
  }
}

/** Prestation tones, in the order they are handed out to services. */
export const SERVICE_TONES = ["sky", "green", "amber", "violet", "teal", "rose", "lime", "blue"] as const

/** Same prestation, same colour, every day and on every screen: no state, no palette to maintain. */
export function getServiceTone(key: string): (typeof SERVICE_TONES)[number] {
  let hash = 0
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  return SERVICE_TONES[hash % SERVICE_TONES.length]
}

export function getPaymentEdge(paymentStatus?: string | null) {
  return paymentStatus === "paid" ? "paid" : paymentStatus === "partial" ? "partial" : "unpaid"
}

// Care progress takes precedence. On a booking still awaiting care the card is
// coloured by its prestation, and the payment shows on the card's left edge.
export function getAppointmentColor(appointment: {
  status: string
  payment_status?: string | null
  service_id?: string | null
  // Lists carry only the prestation's name; the agenda carries the whole row.
  service?: { id?: string | null; name?: string | null } | string | null
}): string {
  if (!["confirmed", "pending"].includes(appointment.status)) return getStatusColor(appointment.status)
  const service = appointment.service
  const key = appointment.service_id || (typeof service === "string" ? service : service?.id || service?.name) || ""
  const tone = key ? getServiceTone(key) : "blue"
  return `appointment-tone appointment-tone-${tone} appointment-pay-${getPaymentEdge(appointment.payment_status)}`
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "Confirmé"
    case "pending":
      return "En attente"
    case "in_progress":
      return "En cours"
    case "completed":
      return "Terminé"
    case "cancelled":
      return "Annulé"
    case "no_show":
      return "Absent"
    case "blocked":
      return "Bloqué"
    default:
      return status
  }
}

export function getStatusDescription(status: string): string {
  switch (status) {
    case "confirmed":
      return "Réservation validée"
    case "pending":
      return "À confirmer"
    case "in_progress":
      return "Service en cours"
    case "completed":
      return "Service effectué"
    case "cancelled":
      return "Rendez-vous annulé"
    case "no_show":
      return "Client absent"
    case "blocked":
      return "Créneau bloqué"
    default:
      return ""
  }
}
