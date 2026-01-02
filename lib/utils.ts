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
      return "bg-green-100 text-green-800 border-green-200"
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "in_progress":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200"
    case "no_show":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "blocked":
      return "bg-gray-100 text-gray-800 border-gray-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
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
