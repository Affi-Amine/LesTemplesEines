"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Client } from "@/lib/types/database"

export function useClientSearch(search?: string, limit = 8) {
  const normalizedSearch = search?.trim() || ""

  return useQuery({
    queryKey: ["clients", "search", normalizedSearch, limit],
    queryFn: () => fetchAPI<Client[]>(`/clients?search=${encodeURIComponent(normalizedSearch)}&limit=${limit}`),
    enabled: normalizedSearch.length >= 2,
    staleTime: 30 * 1000,
  })
}
