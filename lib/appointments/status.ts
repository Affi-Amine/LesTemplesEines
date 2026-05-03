export const BLOCKING_APPOINTMENT_STATUSES = ["confirmed", "pending", "blocked", "in_progress"] as const

export function blocksAppointmentSchedule(status?: string | null): boolean {
  return status !== "cancelled" && status !== "completed" && status !== "no_show"
}
