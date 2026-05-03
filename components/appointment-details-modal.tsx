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
      return "NOW"
    case "completed":
      return "DONE"
    case "cancelled":
      return "CANCEL"
    case "no_show":
      return "ABSENT"
    case "pending":
      return "WAIT"
    default:
      return "OK"
  }
}

function getStatusClass(status: AppointmentStatus) {
  switch (status) {
    case "in_progress":
      return "border-amber-300 bg-amber-100 text-amber-950"
    case "completed":
      return "border-emerald-300 bg-emerald-100 text-emerald-950"
    case "cancelled":
      return "border-rose-300 bg-rose-100 text-rose-950"
    case "no_show":
      return "border-orange-300 bg-orange-100 text-orange-950"
    case "pending":
      return "border-slate-300 bg-slate-100 text-slate-900"
    default:
      return "border-sky-300 bg-sky-100 text-sky-950"
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
        throw new Error(data?.error || "Update failed")
      }

      const message =
        nextStatus === "in_progress"
          ? "Started"
          : nextStatus === "completed"
            ? "Done"
            : "Marked absent"

      toast.success(message)
      await queryClient.invalidateQueries({ queryKey: ["staff-appointments"] })
      await queryClient.invalidateQueries({ queryKey: ["appointments"] })
      setAbsentOpen(false)
      setAbsentNote("")
      onClose()
    } catch (error: any) {
      toast.error("Update failed", {
        description: error.message || "Try again",
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
      <DialogContent className="top-auto bottom-0 max-h-[88svh] max-w-full translate-y-0 rounded-b-none rounded-t-xl border-0 p-0 shadow-2xl sm:top-[50%] sm:bottom-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader className="border-b px-4 pb-2.5 pt-4 text-left">
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span className="text-lg font-bold">Appointment</span>
            <Badge className={cn("border px-2 py-0.5 text-[11px]", getStatusClass(appointment.status))}>
              {getStatusText(appointment.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(88svh-4.5rem)] overflow-y-auto px-4 pb-4 pt-3">
          <div className="rounded-xl bg-[#221d16] p-3.5 text-white">
            <p className="text-xs uppercase tracking-wide text-white/75">{date}</p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <p className="text-3xl font-bold tabular-nums">{start}</p>
              <p className="pb-1 text-xs font-semibold text-white/80">{start} - {end}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b6258]">Massage</p>
              <p className="mt-1 text-lg font-bold leading-tight text-[#221d16]">{normalized.service?.name || "Service"}</p>
              {normalized.service?.duration_minutes ? (
                <p className="mt-1.5 flex items-center gap-2 text-sm text-[#6b6258]">
                  <Clock className="h-4 w-4" />
                  {normalized.service.duration_minutes} min
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b6258]">Client</p>
              <p className="mt-1 flex items-center gap-2 text-base font-bold text-[#221d16]">
                <User className="h-5 w-5" />
                {clientName}
              </p>
              {normalized.client?.phone ? (
                <a
                  href={`tel:${normalized.client.phone}`}
                  className="mt-2.5 flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f4f1ea] text-sm font-bold text-[#221d16]"
                >
                  <Phone className="h-4 w-4" />
                  Call
                </a>
              ) : null}
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b6258]">Place</p>
              <p className="mt-1 flex items-center gap-2 text-base font-bold text-[#221d16]">
                <MapPin className="h-5 w-5" />
                {normalized.salon?.name || "Salon"}
              </p>
              {normalized.salon?.address ? (
                <p className="mt-1 text-sm text-[#6b6258]">{normalized.salon.address}</p>
              ) : null}
            </div>

            {normalized.notes ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950/80">Note</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-amber-950">{normalized.notes}</p>
              </div>
            ) : null}
          </div>

          {absentOpen ? (
            <div className="mt-3 rounded-xl border border-orange-300 bg-orange-50 p-3">
              <p className="font-bold text-orange-950">Absent?</p>
              <Textarea
                value={absentNote}
                onChange={(event) => setAbsentNote(event.target.value)}
                placeholder="Optional note"
                className="mt-2.5 min-h-20 bg-white"
              />
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Button className="h-10 rounded-lg" variant="outline" onClick={() => setAbsentOpen(false)} disabled={Boolean(savingStatus)}>
                  Back
                </Button>
                <Button
                  className="h-10 rounded-lg"
                  variant="destructive"
                  onClick={() => updateStatus("no_show", absentNote.trim() || "Client absent")}
                  disabled={Boolean(savingStatus)}
                >
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <div className="sticky bottom-0 mt-4 grid gap-2 bg-background pt-2">
              {canStart ? (
                <Button
                  className="h-11 rounded-lg text-sm font-bold"
                  onClick={() => updateStatus("in_progress")}
                  disabled={Boolean(savingStatus)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  START
                </Button>
              ) : null}

              {canFinish ? (
                <Button
                  className="h-11 rounded-lg bg-emerald-700 text-sm font-bold hover:bg-emerald-800"
                  onClick={() => updateStatus("completed")}
                  disabled={Boolean(savingStatus)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  DONE
                </Button>
              ) : null}

              {canMarkAbsent ? (
                <Button
                  variant="outline"
                  className="h-10 rounded-lg border-orange-300 text-sm font-bold text-orange-950"
                  onClick={() => setAbsentOpen(true)}
                  disabled={Boolean(savingStatus)}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  ABSENT
                </Button>
              ) : null}

              <Button variant="ghost" className="h-9 rounded-lg text-sm" onClick={onClose}>
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
