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
      return "border-amber-200 bg-amber-100 text-amber-900"
    case "completed":
      return "border-emerald-200 bg-emerald-100 text-emerald-900"
    case "cancelled":
      return "border-rose-200 bg-rose-100 text-rose-900"
    case "no_show":
      return "border-orange-200 bg-orange-100 text-orange-900"
    case "pending":
      return "border-slate-200 bg-slate-100 text-slate-700"
    default:
      return "border-sky-200 bg-sky-100 text-sky-900"
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
      <DialogContent className="top-auto bottom-0 max-h-[92svh] max-w-full translate-y-0 rounded-b-none rounded-t-[1.5rem] border-0 p-0 shadow-2xl sm:top-[50%] sm:bottom-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-[1.5rem]">
        <DialogHeader className="border-b px-4 pb-3 pt-5 text-left">
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span className="text-xl font-black">Appointment</span>
            <Badge className={cn("border px-2.5 py-1", getStatusClass(appointment.status))}>
              {getStatusText(appointment.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(92svh-5rem)] overflow-y-auto px-4 pb-5 pt-4">
          <div className="rounded-2xl bg-[#181612] p-4 text-white">
            <p className="text-sm uppercase tracking-wide text-white/50">{date}</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-4xl font-black tabular-nums">{start}</p>
              <p className="pb-1 text-sm font-bold text-white/65">{start} - {end}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Massage</p>
              <p className="mt-1 text-xl font-black leading-tight">{normalized.service?.name || "Service"}</p>
              {normalized.service?.duration_minutes ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {normalized.service.duration_minutes} min
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-bold">
                <User className="h-5 w-5" />
                {clientName}
              </p>
              {normalized.client?.phone ? (
                <a
                  href={`tel:${normalized.client.phone}`}
                  className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f7f3ed] text-base font-black text-[#181612]"
                >
                  <Phone className="h-5 w-5" />
                  Call
                </a>
              ) : null}
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Place</p>
              <p className="mt-1 flex items-center gap-2 text-base font-bold">
                <MapPin className="h-5 w-5" />
                {normalized.salon?.name || "Salon"}
              </p>
              {normalized.salon?.address ? (
                <p className="mt-1 text-sm text-muted-foreground">{normalized.salon.address}</p>
              ) : null}
            </div>

            {normalized.notes ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">Note</p>
                <p className="mt-1 text-base font-semibold leading-6 text-amber-950">{normalized.notes}</p>
              </div>
            ) : null}
          </div>

          {absentOpen ? (
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="font-black text-orange-950">Absent?</p>
              <Textarea
                value={absentNote}
                onChange={(event) => setAbsentNote(event.target.value)}
                placeholder="Optional note"
                className="mt-3 min-h-20 bg-white"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setAbsentOpen(false)} disabled={Boolean(savingStatus)}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => updateStatus("no_show", absentNote.trim() || "Client absent")}
                  disabled={Boolean(savingStatus)}
                >
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <div className="sticky bottom-0 mt-5 grid gap-2 bg-background pt-2">
              {canStart ? (
                <Button
                  size="lg"
                  className="h-14 rounded-2xl text-base font-black"
                  onClick={() => updateStatus("in_progress")}
                  disabled={Boolean(savingStatus)}
                >
                  <Play className="mr-2 h-5 w-5" />
                  START
                </Button>
              ) : null}

              {canFinish ? (
                <Button
                  size="lg"
                  className="h-14 rounded-2xl bg-emerald-700 text-base font-black hover:bg-emerald-800"
                  onClick={() => updateStatus("completed")}
                  disabled={Boolean(savingStatus)}
                >
                  <Check className="mr-2 h-5 w-5" />
                  DONE
                </Button>
              ) : null}

              {canMarkAbsent ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-2xl border-orange-200 text-base font-black text-orange-900"
                  onClick={() => setAbsentOpen(true)}
                  disabled={Boolean(savingStatus)}
                >
                  <UserX className="mr-2 h-5 w-5" />
                  ABSENT
                </Button>
              ) : null}

              <Button size="lg" variant="ghost" className="h-11 rounded-2xl" onClick={onClose}>
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
