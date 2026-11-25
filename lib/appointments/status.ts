/**
 * Statuses that keep the masseuse busy until the booking's end time.
 * "completed" is one of them: the reception marks a booking "Effectué" as soon
 * as the client pays, often at arrival, while the massage still has an hour to
 * run. Leaving it out offered the rest of that slot to online clients.
 * Only cancelled and no-show bookings free their slot.
 */
export const BLOCKING_APPOINTMENT_STATUSES = ["confirmed", "pending", "blocked", "in_progress", "completed"] as const

export function canRescheduleAppointmentStatus(status?: string | null): boolean {
  return status === "confirmed" || status === "pending"
}

export function blocksAppointmentSchedule(status?: string | null): boolean {
  return status !== "cancelled" && status !== "no_show"
}
