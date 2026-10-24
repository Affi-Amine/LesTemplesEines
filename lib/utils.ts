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

// Care progress takes precedence; payment only colours appointments awaiting care.
export function getAppointmentColor(appointment: { status: string; payment_status?: string | null }): string {
  if (!["confirmed", "pending"].includes(appointment.status)) return getStatusColor(appointment.status)
  return appointment.payment_status === "paid"
    ? "appointment-tone appointment-tone-green bg-emerald-100 text-emerald-950 border-emerald-200"
    : "appointment-tone appointment-tone-red bg-rose-100 text-rose-950 border-rose-200"
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
