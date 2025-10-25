"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Salon } from "@/lib/types/database"

export function useSalons() {
  return useQuery({
    queryKey: ["salons"],
    queryFn: () => fetchAPI<Salon[]>("/salons"),
  })
}
