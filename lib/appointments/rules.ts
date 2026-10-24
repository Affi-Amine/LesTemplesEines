export class SchedulingError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = "SchedulingError"
  }
}

export function normalizeAppointmentStaff(input: { staff_id?: string; staff_ids?: string[] }): string[] {
  const ids = Array.from(new Set(input.staff_ids ?? (input.staff_id ? [input.staff_id] : [])))
  if (!ids.length) throw new SchedulingError("Au moins un praticien doit être affecté")
  if (input.staff_id && !ids.includes(input.staff_id)) {
    throw new SchedulingError("Le praticien principal doit appartenir à l'équipe du rendez-vous")
  }
  return input.staff_id ? [input.staff_id, ...ids.filter(id => id !== input.staff_id)] : ids
}

// An empty list means unrestricted, as specified by the staff editor.
export function canProvideService(allowedServiceIds: string[] | undefined, serviceId?: string) {
  return !serviceId || !allowedServiceIds?.length || allowedServiceIds.includes(serviceId)
}
