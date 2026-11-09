export interface ClientStaffChoiceLike {
  status?: string | null
  client_requested_staff_ids?: unknown
}

export function hasClientRequestedStaff(appointment: ClientStaffChoiceLike): boolean {
  return appointment.status !== "blocked" && Array.isArray(appointment.client_requested_staff_ids)
    && appointment.client_requested_staff_ids.some(id => typeof id === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
}

/** Keep the lock and the existing markers readable even in short overlapping cards. */
export function staffChoiceLaneWidth(appointments: readonly ClientStaffChoiceLike[]) {
  return appointments.some(hasClientRequestedStaff) ? 152 : 128
}
