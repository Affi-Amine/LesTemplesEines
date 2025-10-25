"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Client } from "@/lib/types/database"

export function useClientByPhone(phone?: string) {
  return useQuery({
    queryKey: ["client", "phone", phone],
    queryFn: () => {
      if (!phone) throw new Error("Phone number is required")
      // Encode the phone number for URL
      const encodedPhone = encodeURIComponent(phone)
      return fetchAPI<Client>(`/clients/phone/${encodedPhone}`)
    },
    enabled: !!phone && phone.length >= 10, // Only fetch if phone has at least 10 digits
    retry: false, // Don't retry if client not found (404)
  })
}
