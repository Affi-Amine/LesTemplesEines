"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Service } from "@/lib/types/database"

export function useServices(salonId?: string, enabledByDefault: boolean = false, includeInactive: boolean = false) {
  return useQuery({
    queryKey: ["services", salonId, includeInactive],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (includeInactive) params.append("include_inactive", "true")

      const services = await fetchAPI<Service[]>(`/services?${params.toString()}`)
      if (!salonId) return services

      return services.filter((service: Service & { salons?: Array<{ id?: string; slug?: string }> }) => {
        const salonIds = service.salon_ids?.length ? service.salon_ids : (service.salon_id ? [service.salon_id] : [])
        return (
          salonIds.includes(salonId) ||
          (service.salons || []).some((salon) => salon.id === salonId || salon.slug === salonId)
        )
      })
    },
    enabled: salonId ? true : enabledByDefault, // Fetch if salonId is provided or enabledByDefault is true
  })
}
