"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { toast } from "sonner"
import type { Appointment } from "@/lib/types/database"
import { Icon } from "@iconify/react"

interface ClientData {
  first_name: string
  last_name: string
  phone: string
  email?: string
}

interface CreateAppointmentData {
  salon_id: string
  staff_id: string
  service_id: string
  start_time: string
  end_time?: string
  client_id?: string
  client_data?: ClientData
  client_notes?: string
  notes?: string
  status?: "confirmed" | "pending"
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateAppointmentData) =>
      fetchAPI<Appointment>("/appointments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["availability"] })
      queryClient.invalidateQueries({ queryKey: ["clients"] })

      toast.success("Rendez-vous créé avec succès !", {
        description: "Le client recevra un SMS de confirmation.",
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de la création", {
        description: error.message || "Une erreur est survenue lors de la création du rendez-vous.",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
        duration: 7000,
      })
    },
  })
}
