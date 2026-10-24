"use client"

import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { fetchAPI } from "@/lib/api/client"

type CareStatus = "in_progress" | "completed"

export function AppointmentProgressActions({ appointment, onUpdated }: {
  appointment: { id: string; status: string }
  onUpdated?: (status: CareStatus) => void
}) {
  const queryClient = useQueryClient()
  const lock = useRef(false)
  const currentAppointment = useRef(appointment.id)
  currentAppointment.current = appointment.id
  const [saving, setSaving] = useState(false)
  const canStart = ["confirmed", "pending"].includes(appointment.status)
  const canFinish = appointment.status === "in_progress"
  if (!canStart && !canFinish) return null

  const update = async (status: CareStatus) => {
    if (lock.current) return
    const id = appointment.id
    lock.current = true
    setSaving(true)
    try {
      // Status only: never rewrite payment, team or the reserved time.
      await fetchAPI(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) })
      if (currentAppointment.current === id) onUpdated?.(status)
      await Promise.all(["appointments", "availability", "staff-appointments", "employee-dashboard"].map(key =>
        queryClient.invalidateQueries({ queryKey: [key] })))
      toast.success("Massage marqué effectué")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier le rendez-vous.")
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return <div className="space-y-2 rounded-lg border p-3" aria-label="Avancement du soin">
    <p className="text-xs text-muted-foreground">Le client est venu ? Marquez le rendez-vous comme effectué.</p>
    <Button type="button" disabled={saving} onClick={() => void update("completed")}
      className="w-full border border-blue-200 bg-blue-100 font-semibold text-blue-950 hover:bg-blue-200">
      <CheckCheck className="mr-2 h-4 w-4" />
      {saving ? "Enregistrement…" : "Massage effectué"}
    </Button>
  </div>
}
