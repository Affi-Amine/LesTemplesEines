"use client"

import { useRef, useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchAPI } from "@/lib/api/client"
import { toast } from "sonner"

export function AppointmentManagementLinkButton({ appointment }: { appointment: { id: string; status: string } }) {
  const lock = useRef(false), [saving, setSaving] = useState(false)
  if (appointment.status === "blocked") return null
  const send = async () => {
    if (lock.current) return
    lock.current = true; setSaving(true)
    try {
      await fetchAPI(`/appointments/${appointment.id}/management-link`, { method: "POST", headers: { "X-Booking-Action": "1" }, body: "{}" })
      toast.success("Lien de gestion envoyé au client")
    } catch (error) { toast.error(error instanceof Error ? error.message : "L’envoi a échoué.") }
    finally { lock.current = false; setSaving(false) }
  }
  return <Button type="button" variant="outline" className="w-full whitespace-normal" disabled={saving} onClick={() => void send()}>
    <Send className="h-4 w-4" aria-hidden="true" />{saving ? "Envoi du lien…" : "Envoyer le lien de gestion au client"}
  </Button>
}
