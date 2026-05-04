"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { fr } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { Check, Clock, MapPin, Phone, Play, User, UserX, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type AppointmentStatus = "confirmed" | "pending" | "in_progress" | "completed" | "cancelled" | "no_show" | "blocked"

interface AppointmentDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: {
    id: string
    start_time: string
    end_time: string
    status: AppointmentStatus
    notes?: string | null
    client_notes?: string | null
    client?: {
      first_name?: string | null
      last_name?: string | null
      phone?: string | null
      email?: string | null
    } | null
    service?: {
      name?: string | null
      duration_minutes?: number | null
      price_cents?: number | null
    } | null
    salon?: {
      name?: string | null
      city?: string | null
      address?: string | null
    } | null
    clients?: {
      first_name?: string | null
      last_name?: string | null
      phone?: string | null
      email?: string | null
    } | null
    services?: {
      name?: string | null
      duration_minutes?: number | null
      price_cents?: number | null
    } | null
    salons?: {
      name?: string | null
      city?: string | null
      address?: string | null
    } | null
  } | null
}

const TIMEZONE = "Europe/Paris"

function getStatusText(status: AppointmentStatus) {
  switch (status) {
    case "in_progress":
      return "En cours"
    case "completed":
      return "Terminé"
    case "cancelled":
      return "Annulé"
    case "no_show":
      return "Absent"
    case "pending":
      return "Attente"
    default:
      return "Confirmé"
  }
}

function getStatusClass(status: AppointmentStatus) {
  switch (status) {
    case "in_progress":
      return "border-[#f4b740] bg-[#fff4cf] text-[#5c3d00]"
    case "completed":
      return "border-[#75c7a1] bg-[#e8f8ef] text-[#0b4936]"
    case "cancelled":
      return "border-[#f0a0a7] bg-[#fff0f1] text-[#7b1e2b]"
    case "no_show":
      return "border-[#e6a36f] bg-[#fff3e8] text-[#74380d]"
    case "pending":
      return "border-[#c9d4d0] bg-[#f0f5f2] text-[#35514a]"
    default:
      return "border-[#9cc9bf] bg-[#e8f6f2] text-[#0f4c43]"
  }
}

export function AppointmentDetailsModal({
  isOpen,
  onClose,
  appointment,
}: AppointmentDetailsModalProps) {
  const queryClient = useQueryClient()
  const [savingStatus, setSavingStatus] = useState<AppointmentStatus | null>(null)
  const [absentOpen, setAbsentOpen] = useState(false)
  const [absentNote, setAbsentNote] = useState("")

  const normalized = useMemo(() => {
    if (!appointment) return null

    return {
      client: appointment.client || appointment.clients,
      service: appointment.service || appointment.services,
      salon: appointment.salon || appointment.salons,
      notes: appointment.client_notes || appointment.notes || "",
    }
  }, [appointment])

  if (!appointment || !normalized) return null

  const clientName = `${normalized.client?.first_name || ""} ${normalized.client?.last_name || "Client"}`.trim()
  const start = formatInTimeZone(appointment.start_time, TIMEZONE, "HH:mm")
  const end = formatInTimeZone(appointment.end_time, TIMEZONE, "HH:mm")
  const date = formatInTimeZone(appointment.start_time, TIMEZONE, "EEE d MMM", { locale: fr })

  const updateStatus = async (nextStatus: "in_progress" | "completed" | "no_show", note?: string) => {
    try {
      setSavingStatus(nextStatus)
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...(note ? { internal_notes: note } : {}),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Mise à jour impossible")
      }

      const message =
        nextStatus === "in_progress"
          ? "Rendez-vous lancé"
          : nextStatus === "completed"
            ? "Rendez-vous terminé"
            : "Client marqué absent"

      toast.success(message)
      await queryClient.invalidateQueries({ queryKey: ["staff-appointments"] })
      await queryClient.invalidateQueries({ queryKey: ["appointments"] })
      setAbsentOpen(false)
      setAbsentNote("")
      onClose()
    } catch (error: any) {
      toast.error("Mise à jour impossible", {
        description: error.message || "Réessayez",
      })
    } finally {
      setSavingStatus(null)
    }
  }

  const canStart = appointment.status === "confirmed" || appointment.status === "pending"
  const canFinish = appointment.status === "in_progress"
  const canMarkAbsent = !["completed", "cancelled", "no_show", "blocked"].includes(appointment.status)

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="top-auto bottom-0 max-h-[88svh] max-w-full translate-y-0 overflow-hidden rounded-b-none rounded-t-2xl border-0 bg-[#f6f7f2] p-0 shadow-2xl sm:top-[50%] sm:bottom-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-2xl">
        <DialogHeader className="border-b border-[#dfe5dd] bg-white px-4 pb-3 pt-4 text-left">
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span className="text-lg font-bold text-[#102d28]">Rendez-vous</span>
            <Badge className={cn("border px-2.5 py-1 text-[11px] font-bold", getStatusClass(appointment.status))}>
              {getStatusText(appointment.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(88svh-4.5rem)] overflow-y-auto px-4 pb-4 pt-3">
          <div className="rounded-2xl bg-[#123f38] p-3.5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#cfe7df]">{date}</p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <p className="text-3xl font-bold tabular-nums">{start}</p>
              <p className="pb-1 text-xs font-semibold text-[#d7eee7]">{start} - {end}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="rounded-2xl border border-[#dfe5dd] bg-white p-3.5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b756f]">Prestation</p>
              <p className="mt-1 text-lg font-bold leading-tight text-[#102d28]">{normalized.service?.name || "Prestation"}</p>
              {normalized.service?.duration_minutes ? (
                <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-[#53615b]">
                  <Clock className="h-4 w-4" />
                  {normalized.service.duration_minutes} min
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#dfe5dd] bg-white p-3.5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b756f]">Client</p>
              <p className="mt-1 flex items-center gap-2 text-base font-bold text-[#102d28]">
                <User className="h-5 w-5" />
                {clientName}
              </p>
              {normalized.client?.phone ? (
                <a
                  href={`tel:${normalized.client.phone}`}
                  className="mt-2.5 flex h-10 items-center justify-center gap-2 rounded-xl border border-[#b7d8cd] bg-[#eef8f4] text-sm font-bold text-[#0f4c43] shadow-sm transition active:scale-[0.99]"
                >
                  <Phone className="h-4 w-4" />
                  Appeler
                </a>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#dfe5dd] bg-white p-3.5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b756f]">Lieu</p>
              <p className="mt-1 flex items-center gap-2 text-base font-bold text-[#102d28]">
                <MapPin className="h-5 w-5" />
                {normalized.salon?.name || "Salon"}
              </p>
              {normalized.salon?.address ? (
                <p className="mt-1 text-sm font-medium text-[#53615b]">{normalized.salon.address}</p>
              ) : null}
            </div>

            {normalized.notes ? (
              <div className="rounded-2xl border border-[#f2cd79] bg-[#fff8df] p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#6c520f]">Note</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#4c3907]">{normalized.notes}</p>
              </div>
            ) : null}
          </div>

          {absentOpen ? (
            <div className="mt-3 rounded-2xl border border-[#e6a36f] bg-[#fff3e8] p-3.5">
              <p className="font-bold text-[#74380d]">Client absent ?</p>
              <Textarea
                value={absentNote}
                onChange={(event) => setAbsentNote(event.target.value)}
                placeholder="Note optionnelle"
                className="mt-2.5 min-h-20 border-[#e6c7ad] bg-white"
              />
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Button className="h-10 rounded-lg" variant="outline" onClick={() => setAbsentOpen(false)} disabled={Boolean(savingStatus)}>
                  Retour
                </Button>
                <Button
                  className="h-10 rounded-lg bg-[#b34720] hover:bg-[#923716]"
                  variant="destructive"
                  onClick={() => updateStatus("no_show", absentNote.trim() || "Client absent")}
                  disabled={Boolean(savingStatus)}
                >
                  Confirmer
                </Button>
              </div>
            </div>
          ) : (
            <div className="sticky bottom-0 mt-4 grid gap-2 bg-[#f6f7f2] pt-2">
              {canStart ? (
                <Button
                  className="h-11 rounded-xl bg-[#0f4c43] text-sm font-bold text-white shadow-sm hover:bg-[#0b3d36]"
                  onClick={() => updateStatus("in_progress")}
                  disabled={Boolean(savingStatus)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Démarrer
                </Button>
              ) : null}

              {canFinish ? (
                <Button
                  className="h-11 rounded-xl bg-[#0e7f63] text-sm font-bold text-white shadow-sm hover:bg-[#09664f]"
                  onClick={() => updateStatus("completed")}
                  disabled={Boolean(savingStatus)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Terminer
                </Button>
              ) : null}

              {canMarkAbsent ? (
                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-[#d99a65] bg-white text-sm font-bold text-[#8b3f12] hover:bg-[#fff3e8]"
                  onClick={() => setAbsentOpen(true)}
                  disabled={Boolean(savingStatus)}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Client absent
                </Button>
              ) : null}

              <Button variant="ghost" className="h-9 rounded-xl text-sm font-semibold text-[#53615b]" onClick={onClose}>
                <X className="mr-2 h-4 w-4" />
                Fermer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
