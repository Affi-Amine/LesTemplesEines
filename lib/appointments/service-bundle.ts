import type { createAdminClient } from "@/lib/supabase/admin"
import { combineServices, getSelectedServiceIds } from "@/lib/appointments/service-selection"
import { resolveSalonGroup } from "@/lib/salons/resolve"

export async function loadServiceBundle(supabase: ReturnType<typeof createAdminClient>, primary: string, additional: string[] = [], salonId?: string) {
  const ids = getSelectedServiceIds(primary, additional)
  const { data, error } = await supabase.from("services")
    .select("id, name, duration_minutes, price_cents, required_staff_count, is_active").in("id", ids)
  if (error) throw new Error(error.message)
  const items = ids.map(id => data?.find(service => service.id === id))
  if (items.some(service => !service || !service.is_active)) throw new Error("Une prestation sélectionnée n’est plus disponible.")
  const services = items.filter((service): service is NonNullable<typeof service> => Boolean(service))
  const service = combineServices(services)
  if (ids.length > 1) {
    // Fail before accepting payment if the storage migration has not been applied.
    const probe = await supabase.from("appointments").select("service_items").limit(0)
    if (probe.error) throw new Error("Les réservations avec plusieurs prestations ne sont pas encore activées.")
  }
  if (salonId) {
    const group = await resolveSalonGroup(supabase, salonId)
    const links = await supabase.from("service_salons").select("service_id").in("service_id", ids).in("salon_id", group?.salonIds || [salonId])
    if (links.error) throw new Error(links.error.message)
    if (ids.some(id => !links.data?.some(link => link.service_id === id))) throw new Error("Une prestation n’est pas proposée dans ce temple.")
  }
  return { service, items: services.map(({ is_active, ...item }) => item), ids }
}
