"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { format } from "date-fns"

interface AvailabilitySlot {
  start: string
  end: string
  available_staff?: string[]
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

export function useAvailability(staffId?: string | string[], date?: Date, serviceId?: string) {
  return useQuery({
    queryKey: ["availability", staffId, date ? format(date, "yyyy-MM-dd") : null, serviceId],
    queryFn: () => {
      if (!date) {
        throw new Error("Date is required")
      }

      const formattedDate = format(date, "yyyy-MM-dd")

      // If no staff ID but service ID is present, use service-centric availability
      if ((!staffId || (Array.isArray(staffId) && staffId.length === 0)) && serviceId) {
        const params = new URLSearchParams({
          date: formattedDate,
        })
        return fetchAPI<AvailabilityResponse>(`/availability/service/${serviceId}?${params.toString()}`)
      }

      // If staffId is an array (multi-selection for multi-staff service)
      if (Array.isArray(staffId) && serviceId) {
        const params = new URLSearchParams({
          date: formattedDate,
          staff_ids: staffId.join(',')
        })
        return fetchAPI<AvailabilityResponse>(`/availability/service/${serviceId}?${params.toString()}`)
      }

      if (!staffId) {
        throw new Error("staffId or serviceId is required")
      }

      // Single staff case
      const params = new URLSearchParams({
        date: formattedDate,
      })

      if (serviceId) {
        params.append("service_id", serviceId)
      }

      return fetchAPI<AvailabilityResponse>(`/availability/${staffId}?${params.toString()}`)
    },
    enabled: !!date && (!!staffId || !!serviceId), 
  })
}
