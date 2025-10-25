"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import type { Client } from "@/lib/types/database"

interface CreateClientData {
  phone: string
  email?: string
  first_name: string
  last_name: string
  internal_notes?: string
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClientData) =>
      fetchAPI<Client>("/clients", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (newClient) => {
      // Invalidate clients queries
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      // Set the client in cache for phone lookup
      queryClient.setQueryData(["client", "phone", newClient.phone], newClient)
    },
  })
}
