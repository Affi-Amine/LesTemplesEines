"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCheck, UserX, CalendarX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { fetchAPI } from "@/lib/api/client"

type CareStatus = "in_progress" | "completed" | "cancelled" | "no_show"
type ReleaseStatus = "cancelled" | "no_show"

export function AppointmentProgressActions({ appointment, onUpdated }: {
  appointment: { id: string; status: string }
  onUpdated?: (status: CareStatus) => void
}) {
  const queryClient = useQueryClient()
  const lock = useRef(false)
  const currentAppointment = useRef(appointment.id)
  currentAppointment.current = appointment.id
  const [saving, setSaving] = useState(false)
  const [confirmation, setConfirmation] = useState<ReleaseStatus | null>(null)
  useEffect(() => { setConfirmation(null) }, [appointment.id, appointment.status])
  const active = ["confirmed", "pending", "in_progress"].includes(appointment.status)
  if (!active) return ["cancelled", "no_show"].includes(appointment.status)
    ? <p className="rounded-lg border p-3 text-sm text-muted-foreground">{appointment.status === "no_show" ? "Client absent" : "Rendez-vous annulé"}. Créneau libéré, rendez-vous conservé dans l’historique.</p> : null

  const update = async (status: CareStatus) => {
    if (lock.current) return
    const id = appointment.id
    lock.current = true
    setSaving(true)
    try {
      // A status change releases the slot without deleting its history or payment.
      await fetchAPI(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) })
      if (currentAppointment.current === id) { setConfirmation(null); onUpdated?.(status) }
      await Promise.all(["appointments", "availability", "staff-appointments", "employee-dashboard"].map(key =>
        queryClient.invalidateQueries({ queryKey: [key] })))
      toast.success(status === "no_show" ? "Client marqué absent · créneau libéré" : status === "cancelled" ? "Rendez-vous annulé · créneau libéré" : "Massage marqué effectué")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier le rendez-vous.")
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return <div className="space-y-3 rounded-lg border p-3" aria-label="Actions du rendez-vous">
    {confirmation ? <div role="group" aria-label={confirmation === "no_show" ? "Confirmer l’absence du client" : "Confirmer l’annulation du rendez-vous"} className="space-y-3">
      <p className="font-semibold">{confirmation === "no_show" ? "Le client ne s’est pas présenté ?" : "Annuler ce rendez-vous ?"}</p>
      <p className="text-sm leading-6 text-muted-foreground">Le créneau sera libéré. Le rendez-vous restera dans l’historique avec le statut « {confirmation === "no_show" ? "Absent" : "Annulé"} ». Le paiement sera conservé, sans remboursement automatique.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={saving} onClick={() => setConfirmation(null)}>Garder le rendez-vous</Button>
        <Button type="button" className="appointment-tone appointment-tone-red h-auto min-h-11 whitespace-normal border" disabled={saving} onClick={() => void update(confirmation)}>{saving ? "Enregistrement…" : confirmation === "no_show" ? "Confirmer l’absence" : "Confirmer l’annulation"}</Button>
      </div>
    </div> : <>
      <p className="text-xs text-muted-foreground">Le client est venu ? Marquez le rendez-vous comme effectué.</p>
      <Button type="button" disabled={saving} onClick={() => void update("completed")}
        className="appointment-tone appointment-tone-blue min-h-11 w-full border font-semibold hover:brightness-95">
        <CheckCheck className="mr-2 h-4 w-4" />{saving ? "Enregistrement…" : "Massage effectué"}
      </Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => setConfirmation("no_show")}><UserX className="h-4 w-4" />Client absent</Button>
        <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={saving} onClick={() => setConfirmation("cancelled")}><CalendarX className="h-4 w-4" />Annuler le rendez-vous</Button>
      </div>
    </>}
  </div>
}
