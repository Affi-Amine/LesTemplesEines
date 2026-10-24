export interface SelectedService {
  id: string
  name: string
  duration_minutes: number
  price_cents: number
  required_staff_count?: number
}

export function combineServices<T extends SelectedService>(services: T[]) {
  if (!services.length || services.length > 8) throw new Error("Sélectionnez entre 1 et 8 prestations.")
  if (new Set(services.map(service => service.id)).size !== services.length) throw new Error("Une prestation ne peut être ajoutée qu’une fois.")
  const required = services[0].required_staff_count || 1
  if (services.some(service => (service.required_staff_count || 1) !== required)) {
    throw new Error("Combinez des prestations prévues pour le même nombre de masseuses.")
  }
  if (services.some(service => !Number.isInteger(service.duration_minutes) || service.duration_minutes <= 0 ||
    !Number.isInteger(service.price_cents) || service.price_cents < 0)) throw new Error("Durée ou tarif invalide.")
  return { ...services[0], name: services.map(service => service.name).join(" + "),
    duration_minutes: services.reduce((sum, service) => sum + service.duration_minutes, 0),
    price_cents: services.reduce((sum, service) => sum + service.price_cents, 0), required_staff_count: required }
}

export function getSelectedServiceIds(primary: string, additional: string[] = []) {
  if (additional.length && !additional.includes(primary)) throw new Error("La prestation principale doit faire partie de la sélection.")
  const ids = [primary, ...additional.filter(id => id !== primary)]
  if (!primary || ids.length > 8 || new Set(additional).size !== additional.length) throw new Error("Sélection de prestations invalide.")
  return ids
}

export function presentAppointmentServices<T extends { service?: any; service_items?: SelectedService[] | null }>(appointment: T): T {
  if (!appointment.service_items?.length) return appointment
  const combined = combineServices(appointment.service_items)
  return { ...appointment, service: { ...appointment.service, ...combined } }
}
