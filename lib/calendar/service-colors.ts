import { getServicePlanningColor } from "@/lib/services/planning-colors"

interface PlanningServiceLike { id?: string; name?: string; planning_color?: unknown }
export interface AppointmentPlanningColorsLike {
  status?: string | null
  service_id?: string | null
  service?: PlanningServiceLike | null
  service_items?: PlanningServiceLike[] | null
  planning_services?: PlanningServiceLike[] | null
}

/** Colours are presentation metadata from the current catalogue, never part of the price quote. */
export function getAppointmentServiceColors(appointment: AppointmentPlanningColorsLike) {
  if (appointment.status === "blocked") return []
  const services = Array.isArray(appointment.planning_services) ? appointment.planning_services
    : appointment.service_items?.length ? appointment.service_items.map(item => ({ ...item,
      planning_color: item.id === appointment.service?.id ? appointment.service?.planning_color : null,
    })) : appointment.service ? [appointment.service] : []
  const seen = new Set<string>()
  return services.flatMap(service => {
    const color = getServicePlanningColor(service.planning_color)
    const id = service.id || appointment.service_id
    if (!color || !id || seen.has(id)) return []
    seen.add(id)
    return [{ id, name: service.name || "Prestation", color }]
  })
}
