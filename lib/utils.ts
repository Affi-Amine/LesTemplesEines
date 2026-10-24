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
      return "bg-sky-950 text-sky-100 border-sky-600"
    case "pending":
      return "bg-amber-950 text-amber-100 border-amber-600"
    case "in_progress":
    case "completed":
      return "bg-blue-950 text-blue-100 border-blue-500"
    case "cancelled":
      return "bg-rose-950 text-rose-100 border-rose-500"
    case "no_show":
      return "bg-orange-950 text-orange-100 border-orange-500"
    case "blocked":
      return "bg-zinc-900 text-zinc-200 border-zinc-500"
    default:
      return "bg-zinc-900 text-zinc-200 border-zinc-500"
  }
}

// Care progress takes precedence; payment only colours appointments awaiting care.
export function getAppointmentColor(appointment: { status: string; payment_status?: string | null }): string {
  if (!["confirmed", "pending"].includes(appointment.status)) return getStatusColor(appointment.status)
  return appointment.payment_status === "paid"
    ? "bg-emerald-950 text-emerald-100 border-emerald-500"
    : "bg-amber-950 text-amber-100 border-amber-500"
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
