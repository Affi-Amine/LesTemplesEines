"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Salon } from "@/lib/types/database"

interface UseSalonsOptions {
  includeInactive?: boolean
}

export function useSalons(options?: UseSalonsOptions) {
  const includeInactive = options?.includeInactive ?? false

  return useQuery({
    queryKey: ["salons", { includeInactive }],
    queryFn: () =>
      fetchAPI<Salon[]>(includeInactive ? "/salons?include_inactive=true" : "/salons"),
    staleTime: 0,
    gcTime: 0,
  })
}
