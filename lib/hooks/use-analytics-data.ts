"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface AnalyticsData {
  period: {
    start: string
    end: string
  }
  kpis: {
    total_appointments: number
    total_clients: number
    total_revenue_cents: number
    pending_bookings: number
  }
  upcoming_appointments: Array<{
    id: string
    start_time: string
    end_time: string
    status: string
    client: { first_name: string; last_name: string; phone: string }
    service: { name: string; duration_minutes: number; price_cents: number }
    staff: { first_name: string; last_name: string }
    salon: { name: string; city: string }
  }>
  popular_services: Array<{
    service_id: string
    service_name: string
    booking_count: number
    revenue_cents: number
  }>
  payment_methods: Array<{
    method: string
    count: number
    revenue_cents: number
    percentage: number
  }>
}

export interface AnalyticsFilters {
  startDate?: string
  endDate?: string
  startHour?: string
  endHour?: string
  salonId?: string
  staffId?: string
  paymentMethod?: string
}

export function useAnalyticsData(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ["analytics", "dashboard", filters],
    queryFn: async (): Promise<AnalyticsData> => {
      const params = new URLSearchParams()
      
      if (filters.startDate) params.append("start_date", filters.startDate)
      if (filters.endDate) params.append("end_date", filters.endDate)
      if (filters.startHour) params.append("start_hour", filters.startHour)
      if (filters.endHour) params.append("end_hour", filters.endHour)
      if (filters.salonId) params.append("salon_id", filters.salonId)
      if (filters.staffId) params.append("staff_id", filters.staffId)
      if (filters.paymentMethod) params.append("payment_method", filters.paymentMethod)

      const response = await fetch(`/api/analytics/dashboard?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch analytics data")
      }

      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

export function useSalons() {
  return useQuery({
    queryKey: ["salons"],
    queryFn: async () => {
      const response = await fetch("/api/salons")
      
      if (!response.ok) {
        throw new Error("Failed to fetch salons")
      }

      const data = await response.json()
      return data || []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff")
      
      if (!response.ok) {
        throw new Error("Failed to fetch staff")
      }

      const data = await response.json()
      return data || []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}