"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Calendar, Clock, User } from "lucide-react"
import { format } from "date-fns"
import { useServices } from "@/lib/hooks/use-services"
import { useStaff } from "@/lib/hooks/use-staff"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { findOverlappingAppointment, snapMinuteToQuarter, toQuarterTimeOptions, type CalendarAppointmentLike } from "@/lib/calendar/scheduling"
import { toast } from "sonner"

interface QuickCreateModalProps {
  isOpen: boolean
  onClose: () => void
  salonId: string
  prefillData?: {
    date: Date
    hour: number
    minute: number
    staffId?: string
  }
  existingAppointments?: CalendarAppointmentLike[]
  onSuccess?: () => void
}

export function QuickCreateModal({
  isOpen,
  onClose,
  salonId,
  prefillData,
  existingAppointments = [],
  onSuccess,
}: QuickCreateModalProps) {
  const { data: services } = useServices(salonId)
  const { data: staff } = useStaff(salonId)
  const createAppointment = useCreateAppointment()
  const timeOptions = useMemo(() => toQuarterTimeOptions(8, 20), [])

  const [form, setForm] = useState({
    service_id: "",
    staff_ids: [] as string[],
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  })
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState("09:00")

  useEffect(() => {
    if (isOpen) {
      const date = prefillData?.date ? new Date(prefillData.date) : new Date()
      const hour = prefillData?.hour ?? 9
      const minute = snapMinuteToQuarter(prefillData?.minute ?? 0)

      setSelectedDate(date)
      setStartTime(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
      setForm((prev) => ({
        ...prev,
        staff_ids: prefillData?.staffId ? [prefillData.staffId] : prev.staff_ids,
      }))
    } else {
      setForm({
        service_id: "",
        staff_ids: [],
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        notes: "",
      })
      setStartTime("09:00")
      setSelectedDate(new Date())
    }
  }, [isOpen, prefillData])

  const selectedService = useMemo(
    () => services?.find((service) => service.id === form.service_id),
    [services, form.service_id]
  )

  const selectedStart = useMemo(() => {
    const [hour, minute] = startTime.split(":").map((v) => Number.parseInt(v, 10))
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return null
    }
    const startDateTime = new Date(selectedDate)
    startDateTime.setHours(hour, minute, 0, 0)
    return startDateTime
  }, [selectedDate, startTime])

  const selectedEnd = useMemo(() => {
    if (!selectedStart || !selectedService?.duration_minutes) {
      return null
    }
    const endDateTime = new Date(selectedStart)
    endDateTime.setMinutes(endDateTime.getMinutes() + selectedService.duration_minutes)
    return endDateTime
  }, [selectedStart, selectedService?.duration_minutes])

  const conflict = useMemo(() => {
    if (!selectedStart || !selectedEnd || form.staff_ids.length === 0 || !form.service_id) {
      return null
    }

    for (const staffId of form.staff_ids) {
      const overlapping = findOverlappingAppointment({
        appointments: existingAppointments,
        staffId,
        start: selectedStart,
        end: selectedEnd,
      })
      if (overlapping) {
        return { staffId, appointment: overlapping }
      }
    }

    return null
  }, [existingAppointments, form.service_id, form.staff_ids, selectedEnd, selectedStart])

  const toggleStaffSelection = (staffId: string) => {
    const current = form.staff_ids
    if (current.includes(staffId)) {
      setForm({ ...form, staff_ids: current.filter((id) => id !== staffId) })
    } else {
      setForm({ ...form, staff_ids: [...current, staffId] })
    }
  }

  const hasRequiredFields = Boolean(
    selectedStart &&
      form.staff_ids.length > 0 &&
      form.service_id &&
      form.first_name &&
      form.last_name &&
      form.phone
  )
  const canSubmit = hasRequiredFields && !conflict && !createAppointment.isPending

  const handleSubmit = async () => {
    if (!selectedStart || !hasRequiredFields) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }
    if (conflict) {
      toast.error("Conflit détecté: ce créneau chevauche un rendez-vous existant")
      return
    }

    createAppointment.mutate(
      {
        salon_id: salonId,
        service_id: form.service_id,
        staff_ids: form.staff_ids,
        staff_id: form.staff_ids[0],
        start_time: selectedStart.toISOString(),
        client_data: {
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          email: form.email || undefined,
        },
        client_notes: form.notes,
        status: "confirmed",
      },
      {
        onSuccess: () => {
          onClose()
          onSuccess?.()
        },
      }
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Nouveau rendez-vous rapide
          </DialogTitle>
          <DialogDescription>
            Créer un rendez-vous pour le créneau sélectionné
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 p-3 bg-primary/5 rounded-lg text-sm">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Date
            </Label>
            <Input
              type="date"
              value={format(selectedDate, "yyyy-MM-dd")}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split("-").map((v) => Number.parseInt(v, 10))
                if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
                  const nextDate = new Date(selectedDate)
                  nextDate.setFullYear(year, month - 1, day)
                  setSelectedDate(nextDate)
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Heure de début
            </Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une heure" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((timeValue) => (
                  <SelectItem key={timeValue} value={timeValue}>
                    {timeValue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Service *</Label>
            <Select
              value={form.service_id}
              onValueChange={(val) => setForm({ ...form, service_id: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un service" />
              </SelectTrigger>
              <SelectContent>
                {services?.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} min) - {service.price_cents / 100}€
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prestataire(s) *</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.staff_ids.map((id) => {
                const member = staff?.find((s) => s.id === id)
                return (
                  <Badge key={id} variant="secondary" className="gap-1 flex items-center p-2">
                    <span>
                      {member?.first_name} {member?.last_name}
                    </span>
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive ml-1"
                      onClick={() => toggleStaffSelection(id)}
                    />
                  </Badge>
                )
              })}
            </div>
            <Select onValueChange={(val) => toggleStaffSelection(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Ajouter un prestataire" />
              </SelectTrigger>
              <SelectContent>
                {staff
                  ?.filter((s) => !form.staff_ids.includes(s.id))
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {conflict && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Conflit détecté: un rendez-vous existe déjà sur ce créneau pour le prestataire sélectionné.
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Informations client
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prénom *</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Prénom"
              />
            </div>
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Nom"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Téléphone *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="06..."
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="client@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Notes sur le rendez-vous..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {createAppointment.isPending ? "Création..." : "Créer le rendez-vous"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
