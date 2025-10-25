"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Staff } from "@/lib/types/database"

export function useStaff(salonId?: string) {
  return useQuery({
    queryKey: ["staff", salonId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (salonId) params.append("salon_id", salonId)
      return fetchAPI<Staff[]>(`/staff?${params.toString()}`)
    },
  })
}
