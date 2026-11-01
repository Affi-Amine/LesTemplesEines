"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatInTimeZone } from "date-fns-tz"
import { fr } from "date-fns/locale"
import { Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { fetchAPI } from "@/lib/api/client"
import { canStaffTakeBookings, dateTimeInScheduleTimezone, getAppointmentStaffIds, getStaffDisplayName } from "@/lib/calendar/scheduling"
import type { Staff } from "@/lib/types/database"

const TIMEZONE = "Europe/Paris"

type StaffName = { id?: string | null; first_name?: string | null; last_name?: string | null }

interface BlockedSlot {
  id: string
  start_time: string
  end_time: string
  salon_id?: string | null
  salon?: { id?: string | null; name?: string | null } | null
  client_notes?: string | null
  staff_id?: string | null
  staff?: StaffName | null
  assignments?: Array<{ staff_id?: string | null; staff?: StaffName | null }> | null
}

/** Edit (time, masseuses, note) or delete a blocked slot of the planning. */
export function BlockedSlotDialog({ slot, open, onOpenChange, onChanged }: {
  slot: BlockedSlot | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ date: "", startTime: "", endTime: "", staffIds: [] as string[], note: "" })
  const [busy, setBusy] = useState<"save" | "delete" | null>(null)

  const salonId = slot?.salon_id || slot?.salon?.id || undefined
  const { data: salonStaff = [] } = useQuery({
    queryKey: ["staff", salonId],
    queryFn: () => fetchAPI<Staff[]>(`/staff?salon_id=${salonId}`),
    enabled: open && Boolean(salonId),
  })
  const bookableStaff = salonStaff.filter(canStaffTakeBookings)

  useEffect(() => {
    if (!slot || !open) return
    setForm({
      date: formatInTimeZone(slot.start_time, TIMEZONE, "yyyy-MM-dd"),
      startTime: formatInTimeZone(slot.start_time, TIMEZONE, "HH:mm"),
      endTime: formatInTimeZone(slot.end_time, TIMEZONE, "HH:mm"),
      staffIds: getAppointmentStaffIds(slot),
      note: slot.client_notes || "",
    })
  }, [slot, open])

  if (!slot) return null

  const staffName = (id: string) => {
    const member = salonStaff.find(item => item.id === id) ||
      slot.assignments?.find(assignment => assignment.staff?.id === id)?.staff ||
      (slot.staff?.id === id ? slot.staff : null)
    return member ? getStaffDisplayName(member) : "Masseuse"
  }

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["availability"] }),
    ])
    onChanged?.()
    onOpenChange(false)
  }

  const handleSave = async () => {
    const day = new Date(`${form.date}T00:00:00`)
    const start = dateTimeInScheduleTimezone(day, form.startTime)
    const end = dateTimeInScheduleTimezone(day, form.endTime)
    if (!form.date || !start || !end) return void toast.error("Horaires invalides")
    if (end <= start) return void toast.error("L'heure de fin doit être après l'heure de début")
    if (form.staffIds.length === 0) return void toast.error("Choisissez au moins une masseuse")

    setBusy("save")
    try {
      const response = await fetch(`/api/appointments/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          staff_ids: form.staffIds,
          client_notes: form.note,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Modification impossible")
      }
      toast.success("Blocage modifié", { description: `${form.startTime} – ${form.endTime}` })
      await refresh()
    } catch (error) {
      toast.error("Impossible de modifier le blocage", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Supprimer ce blocage ? Le créneau redeviendra réservable.")) return
    setBusy("delete")
    try {
      const response = await fetch(`/api/appointments/${slot.id}`, { method: "DELETE" })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Suppression impossible")
      }
      toast.success("Blocage supprimé", { description: "Le créneau est de nouveau disponible." })
      await refresh()
    } catch (error) {
      toast.error("Impossible de supprimer le blocage", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créneau bloqué</DialogTitle>
          <DialogDescription className="capitalize">
            {formatInTimeZone(slot.start_time, TIMEZONE, "EEEE d MMMM yyyy", { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Masseuses</Label>
            <div className="flex flex-wrap gap-2">
              {form.staffIds.map(id => (
                <Badge key={id} variant="secondary" className="gap-1 p-2">
                  {staffName(id)}
                  <button type="button" aria-label={`Retirer ${staffName(id)}`} className="cursor-pointer hover:text-destructive"
                    onClick={() => setForm(current => ({ ...current, staffIds: current.staffIds.filter(item => item !== id) }))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Select value="" onValueChange={id => setForm(current => ({ ...current, staffIds: [...current.staffIds, id] }))}>
              <SelectTrigger><SelectValue placeholder="Ajouter une masseuse" /></SelectTrigger>
              <SelectContent>
                {bookableStaff.filter(member => !form.staffIds.includes(member.id)).map(member => (
                  <SelectItem key={member.id} value={member.id}>{getStaffDisplayName(member)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="blocked-slot-date">Date</Label>
              <Input id="blocked-slot-date" type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blocked-slot-start">Début</Label>
              <Input id="blocked-slot-start" type="time" step={900} value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blocked-slot-end">Fin</Label>
              <Input id="blocked-slot-end" type="time" step={900} value={form.endTime} onChange={event => setForm({ ...form, endTime: event.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blocked-slot-note">Note (optionnel)</Label>
            <Textarea id="blocked-slot-note" placeholder="Raison du blocage..." value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="destructive" onClick={handleDelete} disabled={Boolean(busy)} className="cursor-pointer">
            <Trash2 className="mr-2 h-4 w-4" />
            {busy === "delete" ? "Suppression…" : "Supprimer"}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={Boolean(busy)} className="cursor-pointer">Fermer</Button>
            <Button onClick={handleSave} disabled={Boolean(busy)} className="cursor-pointer">
              {busy === "save" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
