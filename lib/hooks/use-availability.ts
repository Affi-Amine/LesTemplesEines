"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { format, isValid } from "date-fns"

export interface AvailabilitySlot {
  start: string
  end: string
  available_staff?: string[]
}

export interface AvailabilityResponse {
  staff_id?: string
  staff_name?: string
  date: string
  service_duration_minutes?: number
  salon_hours?: { open: string; close: string }
  available_slots: AvailabilitySlot[]
  total_slots?: number
  required_staff?: number
}

function formatAvailabilityDate(date?: Date | string) {
  if (!date) return null
  if (typeof date === "string") return date
  return isValid(date) ? format(date, "yyyy-MM-dd") : null
}

function normalizeStaffKey(staffId?: string | string[]) {
  if (!staffId) return null
  return Array.isArray(staffId) ? [...staffId].sort().join(",") : staffId
}

export function useAvailability(staffId?: string | string[], date?: Date | string, serviceId?: string, salonId?: string, options?: { enabled?: boolean; version?: string; serviceIds?: string[] }) {
  const formattedDate = formatAvailabilityDate(date)
  const staffKey = normalizeStaffKey(staffId)

  return useQuery({
    queryKey: ["availability", staffKey, formattedDate, serviceId, salonId, options?.version, options?.serviceIds],
    queryFn: ({ signal }) => {
      if (!formattedDate) {
        throw new Error("Date is required")
      }

      // Booking availability is service-centric. When a staff member is selected,
      // pass it as a filter so the API keeps one scheduling algorithm.
      if (serviceId && salonId) {
        const params = new URLSearchParams({
          date: formattedDate,
        })

        params.append("salon_id", salonId)
        if (options?.serviceIds && options.serviceIds.length > 1) params.append("service_ids", options.serviceIds.join(","))
        if (Array.isArray(staffId) && staffId.length > 0) {
          params.append("staff_ids", staffId.join(","))
        } else if (typeof staffId === "string" && staffId) {
          params.append("staff_ids", staffId)
        }

        return fetchAPI<AvailabilityResponse>(`/availability/service/${serviceId}?${params.toString()}`, { signal, cache: "no-store" })
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

      return fetchAPI<AvailabilityResponse>(`/availability/${staffId}?${params.toString()}`, { signal, cache: "no-store" })
    },
    enabled: options?.enabled !== false && !!formattedDate && !!serviceId && !!salonId,
    refetchOnMount: "always",
    staleTime: 10 * 1000, // Consider stale after 10 seconds (overrides default 60s)
    refetchInterval: 30 * 1000, // Refetch every 30 seconds to catch newly booked slots
  })
}
