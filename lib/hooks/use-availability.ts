"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { format } from "date-fns"

interface AvailabilitySlot {
  start: string
  end: string
}

interface AvailabilityResponse {
  staff_id: string
  staff_name: string
  date: string
  service_duration_minutes: number
  salon_hours: { open: string; close: string }
  available_slots: AvailabilitySlot[]
  total_slots: number
}

export function useAvailability(staffId?: string, date?: Date, serviceId?: string) {
  return useQuery({
    queryKey: ["availability", staffId, date ? format(date, "yyyy-MM-dd") : null, serviceId],
    queryFn: () => {
      if (!staffId || !date) {
        throw new Error("staffId and date are required")
      }

      const params = new URLSearchParams({
        date: format(date, "yyyy-MM-dd"),
      })

      if (serviceId) {
        params.append("service_id", serviceId)
      }

      return fetchAPI<AvailabilityResponse>(`/availability/${staffId}?${params.toString()}`)
    },
    enabled: !!staffId && !!date, // Only fetch if both staffId and date are provided
  })
}
