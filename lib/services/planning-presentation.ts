import { z } from "zod"
import type { createAdminClient } from "@/lib/supabase/admin"
import { SERVICE_PLANNING_COLORS, type ServicePlanningColor } from "@/lib/services/planning-colors"

const colorIds = SERVICE_PLANNING_COLORS.map(color => color.id) as [ServicePlanningColor, ...ServicePlanningColor[]]
const allowedColors = new Set<string>(colorIds)
export const ServicePlanningColorSchema = z.enum(colorIds).nullable().optional()

export async function assertServicePlanningColorStorage(supabase: ReturnType<typeof createAdminClient>) {
  const { error } = await supabase.from("services").select("planning_color").limit(0)
  if (error) {
    const unavailable = new Error("La couleur de la prestation ne peut pas être enregistrée pour le moment. La mise à jour des couleurs du planning doit être installée.") as Error & { code: string; status: number }
    unavailable.code = "SERVICE_PLANNING_COLOR_STORAGE"
    unavailable.status = 503
    throw unavailable
  }
}

export interface PlanningService {
  id: string
  name: string
  planning_color: ServicePlanningColor | null
}

interface PlanningAppointment {
  status?: string | null
  service_id?: string | null
  service?: { id?: string; name?: string } | null
  service_items?: { id: string; name: string }[] | null
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function appointmentServices(appointment: PlanningAppointment): { id: string; name: string }[] {
  if (appointment.status === "blocked") return []
  if (appointment.service_items?.length) return appointment.service_items.map(item => ({ id: item.id, name: item.name }))
  const id = appointment.service_id || appointment.service?.id
  return id ? [{ id, name: appointment.service?.name || "Prestation" }] : []
}

/** Cosmetic catalogue data is live; the booking's historical quote stays untouched. */
export async function attachAppointmentPlanningServices<T extends PlanningAppointment>(supabase: ReturnType<typeof createAdminClient>, appointments: T[]): Promise<(T & { planning_services: PlanningService[] })[]> {
  const itemsByAppointment = appointments.map(appointmentServices)
  // Unmapped imports can carry arbitrary external IDs in their display snapshots.
  const ids = [...new Set(itemsByAppointment.flatMap(items => items.map(item => item.id)).filter(id => uuid.test(id)))]
  const colors = new Map<string, ServicePlanningColor | null>()
  if (ids.length) {
    try {
      const { data, error } = await supabase.from("services").select("id, planning_color").in("id", ids)
      if (!error) for (const service of data || []) colors.set(service.id,
        typeof service.planning_color === "string" && allowedColors.has(service.planning_color) ? service.planning_color as ServicePlanningColor : null)
    } catch {
      // A missing optional column or temporary cosmetic lookup failure must not hide the planning.
    }
  }
  return appointments.map((appointment, index) => ({ ...appointment,
    planning_services: itemsByAppointment[index].map(item => ({ ...item, planning_color: colors.get(item.id) || null })),
  }))
}
