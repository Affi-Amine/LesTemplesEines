"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Appointment } from "@/lib/types/database"

interface UseAppointmentsParams {
  salonId?: string
  staffId?: string
  clientId?: string
  startDate?: string
  endDate?: string
  status?: string
}

export function useAppointments(params?: UseAppointmentsParams) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (params?.salonId) searchParams.append("salon_id", params.salonId)
      if (params?.staffId) searchParams.append("staff_id", params.staffId)
      if (params?.clientId) searchParams.append("client_id", params.clientId)
      if (params?.startDate) searchParams.append("start_date", params.startDate)
      if (params?.endDate) searchParams.append("end_date", params.endDate)
      if (params?.status) searchParams.append("status", params.status)

      return fetchAPI<Appointment[]>(`/appointments?${searchParams.toString()}`)
    },
  })
}
