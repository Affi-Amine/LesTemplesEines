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
import { formatInTimeZone, toZonedTime } from "date-fns-tz"
import { useServices } from "@/lib/hooks/use-services"
import { useStaff } from "@/lib/hooks/use-staff"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { useClientSearch } from "@/lib/hooks/use-client-search"
import {
  findOverlappingAppointment,
  getDefaultStartTimeForDate,
  quarterOptionsBetween,
  resolveOpeningHoursForDate,
  snapMinuteToQuarter,
  toQuarterTimeOptions,
  type CalendarAppointmentLike,
  type SalonOpeningHours,
} from "@/lib/calendar/scheduling"
import { toast } from "sonner"
import type { Client } from "@/lib/types/database"
import { ClientSuggestionList } from "@/components/client-suggestion-list"

type QuickCreateMode = "appointment" | "blocked"

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
  openingHours?: SalonOpeningHours | null
  onSuccess?: () => void
}

export function QuickCreateModal({
  isOpen,
  onClose,
  salonId,
  prefillData,
  existingAppointments = [],
  openingHours,
  onSuccess,
}: QuickCreateModalProps) {
  const { data: services } = useServices(salonId)
  const { data: staff } = useStaff(salonId)
  const createAppointment = useCreateAppointment()
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [debouncedClientSearchTerm, setDebouncedClientSearchTerm] = useState("")
  const { data: clientSuggestions, isFetching: isFetchingClientSuggestions } = useClientSearch(
    debouncedClientSearchTerm,
    8
  )
  const blockedDurationOptions = [15, 30, 45, 60, 90, 120, 180]
  const todayInParis = useMemo(() => formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd"), [])

  const [form, setForm] = useState({
    service_id: "",
    staff_ids: [] as string[],
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  })
  const [mode, setMode] = useState<QuickCreateMode>("appointment")
  const [blockedDurationMinutes, setBlockedDurationMinutes] = useState("60")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState("09:00")
  const selectedOpeningHours = useMemo(
    () => resolveOpeningHoursForDate(openingHours, selectedDate),
    [openingHours, selectedDate]
  )
  const timeOptions = useMemo(
    () => selectedOpeningHours
      ? quarterOptionsBetween(selectedOpeningHours.open, selectedOpeningHours.close)
      : toQuarterTimeOptions(8, 20),
    [selectedOpeningHours]
  )

  useEffect(() => {
    if (isOpen) {
      const date = prefillData?.date ? new Date(prefillData.date) : new Date()
      const defaultTime = getDefaultStartTimeForDate(openingHours, date)
      const [defaultHour, defaultMinute] = defaultTime.split(":").map((value) => Number.parseInt(value, 10))
      const hour = prefillData?.hour ?? (Number.isNaN(defaultHour) ? 9 : defaultHour)
      const minute = snapMinuteToQuarter(prefillData?.minute ?? 0)

      setSelectedDate(date)
      setStartTime(`${hour.toString().padStart(2, "0")}:${(prefillData ? minute : defaultMinute || 0).toString().padStart(2, "0")}`)
      setMode("appointment")
      setBlockedDurationMinutes("60")
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
      setMode("appointment")
      setBlockedDurationMinutes("60")
      setStartTime("09:00")
      setSelectedDate(new Date())
      setClientSearchTerm("")
      setDebouncedClientSearchTerm("")
    }
  }, [isOpen, openingHours, prefillData])

  useEffect(() => {
    if (!isOpen || timeOptions.length === 0 || timeOptions.includes(startTime)) {
      return
    }
    setStartTime(timeOptions[0])
  }, [isOpen, startTime, timeOptions])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedClientSearchTerm(clientSearchTerm.trim())
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [clientSearchTerm])

  const selectedService = useMemo(
    () => services?.find((service) => service.id === form.service_id),
    [services, form.service_id]
  )
  const eligibleStaff = useMemo(() => {
    if (!staff) {
      return []
    }

    if (mode === "blocked" || !form.service_id) {
      return staff
    }

    return staff.filter((member) => {
      const allowedServices = member.allowed_service_ids || []
      return allowedServices.length === 0 || allowedServices.includes(form.service_id)
    })
  }, [form.service_id, mode, staff])

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
    if (!selectedStart) {
      return null
    }

    const durationMinutes = mode === "blocked"
      ? Number.parseInt(blockedDurationMinutes, 10)
      : selectedService?.duration_minutes

    if (!durationMinutes) {
      return null
    }

    const endDateTime = new Date(selectedStart)
    endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes)
    return endDateTime
  }, [blockedDurationMinutes, mode, selectedService?.duration_minutes, selectedStart])

  const conflict = useMemo(() => {
    if (!selectedStart || !selectedEnd || form.staff_ids.length === 0 || (mode === "appointment" && !form.service_id)) {
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
  }, [existingAppointments, form.service_id, form.staff_ids, mode, selectedEnd, selectedStart])

  const toggleStaffSelection = (staffId: string) => {
    const current = form.staff_ids
    if (current.includes(staffId)) {
      setForm({ ...form, staff_ids: current.filter((id) => id !== staffId) })
    } else {
      setForm({ ...form, staff_ids: [...current, staffId] })
    }
  }

  const handleClientFieldChange = (field: "phone" | "first_name" | "last_name", value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
    setClientSearchTerm(value)
  }

  const handleSelectClientSuggestion = (client: Client) => {
    setForm((current) => ({
      ...current,
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      phone: client.phone || "",
      email: client.email || "",
    }))
    setClientSearchTerm("")
    setDebouncedClientSearchTerm("")
  }

  const hasRequiredFields = Boolean(
    selectedStart &&
      timeOptions.length > 0 &&
      form.staff_ids.length > 0 &&
      (
        mode === "blocked"
          ? selectedEnd
          : form.service_id &&
            form.first_name &&
            form.last_name &&
            form.phone
      )
  )
  const canSubmit = hasRequiredFields && !conflict && !createAppointment.isPending

  const handleSubmit = async () => {
    if (!selectedStart || !hasRequiredFields) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }
    const nowInParis = toZonedTime(new Date(), "Europe/Paris")
    const selectedStartInParis = toZonedTime(selectedStart, "Europe/Paris")
    if (selectedStartInParis.getTime() < nowInParis.getTime()) {
      toast.error("Impossible de créer un rendez-vous dans le passé")
      return
    }
    if (conflict) {
      toast.error("Conflit détecté: ce créneau chevauche un rendez-vous existant")
      return
    }

    createAppointment.mutate(
      mode === "blocked"
        ? {
            salon_id: salonId,
            staff_ids: form.staff_ids,
            staff_id: form.staff_ids[0],
            start_time: selectedStart.toISOString(),
            end_time: selectedEnd?.toISOString(),
            notes: form.notes || "Créneau bloqué depuis le calendrier",
            status: "blocked",
            payment_status: "unpaid",
            payment_method: "on_site",
          }
        : {
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
            booking_source: "admin",
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
            {mode === "blocked" ? "Bloquer un créneau" : "Nouveau rendez-vous rapide"}
          </DialogTitle>
          <DialogDescription>
            {mode === "blocked"
              ? "Empêcher toute réservation sur ce créneau."
              : "Créer un rendez-vous pour le créneau sélectionné"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={mode === "appointment" ? "default" : "outline"}
            onClick={() => setMode("appointment")}
          >
            Rendez-vous
          </Button>
          <Button
            type="button"
            variant={mode === "blocked" ? "default" : "outline"}
            onClick={() => setMode("blocked")}
          >
            Bloquer un créneau
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 p-3 bg-primary/5 rounded-lg text-sm">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Date
            </Label>
            <Input
              type="date"
              value={format(selectedDate, "yyyy-MM-dd")}
              min={todayInParis}
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
                {timeOptions.length > 0 ? (
                  timeOptions.map((timeValue) => (
                    <SelectItem key={timeValue} value={timeValue}>
                      {timeValue}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="closed" disabled>
                    Salon fermé ce jour
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            {mode === "blocked" ? (
              <>
                <Label>Durée du blocage *</Label>
                <Select value={blockedDurationMinutes} onValueChange={setBlockedDurationMinutes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une durée" />
                  </SelectTrigger>
                  <SelectContent>
                    {blockedDurationOptions.map((duration) => (
                      <SelectItem key={duration} value={String(duration)}>
                        {duration} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Masseuse(s) *</Label>
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
                <SelectValue placeholder="Ajouter une masseuse" />
              </SelectTrigger>
              <SelectContent>
                {staff
                  ?.filter((s) => eligibleStaff.some((eligibleMember) => eligibleMember.id === s.id))
                  .filter((s) => !form.staff_ids.includes(s.id))
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
              Conflit détecté: un rendez-vous existe déjà sur ce créneau pour la masseuse sélectionnée.
            </div>
          )}

          {mode === "appointment" ? (
            <>
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
                    onChange={(e) => handleClientFieldChange("first_name", e.target.value)}
                    placeholder="Prénom"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => handleClientFieldChange("last_name", e.target.value)}
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => handleClientFieldChange("phone", e.target.value)}
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

              <ClientSuggestionList
                visible={debouncedClientSearchTerm.length >= 2 || clientSearchTerm.trim().length >= 2}
                clients={clientSuggestions}
                isLoading={isFetchingClientSuggestions}
                onSelect={handleSelectClientSuggestion}
              />
            </>
          ) : (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Aucun client n’est créé pour un créneau bloqué. Le blocage servira uniquement à rendre ce créneau indisponible.
            </div>
          )}

          <div className="space-y-2">
            <Label>{mode === "blocked" ? "Raison du blocage" : "Notes"}</Label>
            <Textarea
              placeholder={mode === "blocked" ? "Ex: pause, absence, salle indisponible..." : "Notes sur le rendez-vous..."}
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
            {createAppointment.isPending
              ? "Création..."
              : mode === "blocked"
                ? "Bloquer le créneau"
                : "Créer le rendez-vous"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
