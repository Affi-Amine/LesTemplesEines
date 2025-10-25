"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Service } from "@/lib/types/database"

export function useServices(salonId?: string, enabledByDefault: boolean = false) {
  return useQuery({
    queryKey: ["services", salonId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (salonId) params.append("salon_id", salonId)
      return fetchAPI<Service[]>(`/services?${params.toString()}`)
    },
    enabled: salonId ? true : enabledByDefault, // Fetch if salonId is provided or enabledByDefault is true
  })
}
