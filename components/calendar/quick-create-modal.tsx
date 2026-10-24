"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, User } from "lucide-react"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { useServices } from "@/lib/hooks/use-services"
import { useStaff } from "@/lib/hooks/use-staff"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { useClientSearch } from "@/lib/hooks/use-client-search"
import { APIError, fetchAPI } from "@/lib/api/client"
import { canUseClientPackStatus } from "@/lib/packs"
import {
  findOverlappingAppointment,
  canStaffTakeBookings,
  getStaffDisplayName,
  getDefaultStartTimeForDate,
  quarterOptionsBetween,
  resolveOpeningHoursForDate,
  snapMinuteToQuarter,
  dateTimeInScheduleTimezone,
  toQuarterTimeOptions,
  type CalendarAppointmentLike,
  type SalonOpeningHours,
} from "@/lib/calendar/scheduling"
import { toast } from "sonner"
import type { Client, ClientPack } from "@/lib/types/database"
import { ClientSuggestionList } from "@/components/client-suggestion-list"
import { AppointmentSchedulePicker } from "@/components/calendar/appointment-schedule-picker"
import { useAppointmentSchedule } from "@/lib/hooks/use-appointment-schedule"
import { ClientDataSchema } from "@/lib/appointments/client-data"

type QuickCreateMode = "appointment" | "blocked"
type QuickPaymentMethod = "on_site" | "pack" | "gift_card"

type ValidatedGiftCard = {
  id: string
  code: string
  amount_cents: number
  service_id: string
  service?: {
    id: string
    name: string
    duration_minutes: number
    price_cents: number
  } | null
}

interface QuickCreateModalProps {
  isOpen: boolean
  onClose: () => void
  salonId: string
  initialDate?: Date
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

export function QuickCreateModal(props: QuickCreateModalProps) {
  if (!props.isOpen) return null
  const key = [props.salonId, props.prefillData?.date.toISOString() || props.initialDate?.toISOString(), props.prefillData?.hour, props.prefillData?.minute, props.prefillData?.staffId].join(":")
  return <QuickCreateSession key={key} {...props} />
}

function QuickCreateSession({
  isOpen,
  onClose,
  salonId,
  prefillData,
  initialDate,
  existingAppointments = [],
  openingHours,
  onSuccess,
}: QuickCreateModalProps) {
  const { data: services, isPending: servicesLoading, isError: servicesError, refetch: reloadServices } = useServices(salonId)
  const queryClient = useQueryClient()
  const submitting = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  const { data: staff } = useStaff(salonId)
  const createAppointment = useCreateAppointment()
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [debouncedClientSearchTerm, setDebouncedClientSearchTerm] = useState("")
  const { data: clientSuggestions, isFetching: isFetchingClientSuggestions } = useClientSearch(
    debouncedClientSearchTerm,
    8
  )
  const blockedDurationOptions = [15, 30, 45, 60, 90, 120, 180]
  const todayInParis = formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd")

  const [form, setForm] = useState({
    client_id: "",
    service_id: "",
    staff_ids: prefillData?.staffId ? [prefillData.staffId] : [] as string[],
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
    payment_method: "on_site" as QuickPaymentMethod,
    client_pack_id: "",
    gift_card_code: "",
  })
  const [isRedeemingGiftCard, setIsRedeemingGiftCard] = useState(false)
  const [mode, setMode] = useState<QuickCreateMode>("appointment")
  const [blockedDurationMinutes, setBlockedDurationMinutes] = useState("60")
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(prefillData?.date || initialDate || new Date()))
  const [startTime, setStartTime] = useState(() => prefillData
    ? `${String(prefillData.hour).padStart(2, "0")}:${String(snapMinuteToQuarter(prefillData.minute)).padStart(2, "0")}`
    : getDefaultStartTimeForDate(openingHours, initialDate || new Date()))
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
    if (mode !== "blocked" || !isOpen || timeOptions.length === 0 || timeOptions.includes(startTime)) {
      return
    }
    setStartTime(timeOptions[0])
  }, [isOpen, mode, startTime, timeOptions])

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
  const selectedServiceRequiredStaffCount = selectedService?.required_staff_count || 1
  const eligibleStaff = useMemo(() => (staff || []).filter(member =>
    member.salon_id === salonId && canStaffTakeBookings(member)), [staff, salonId])
  const schedule = useAppointmentSchedule({
    salonId, serviceId: form.service_id, date: format(selectedDate, "yyyy-MM-dd"),
    requiredStaff: selectedServiceRequiredStaffCount, durationMinutes: selectedService?.duration_minutes || 0,
  }, mode === "appointment" && isOpen, prefillData?.staffId)

  const selectedStart = useMemo(() => {
    if (mode === "appointment") return schedule.slot ? new Date(schedule.slot.start) : null
    const [hour, minute] = startTime.split(":").map((v) => Number.parseInt(v, 10))
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return null
    }
    return dateTimeInScheduleTimezone(selectedDate, `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
  }, [selectedDate, startTime, mode, schedule.slot])

  const selectedEnd = useMemo(() => {
    if (mode === "appointment") return schedule.slot ? new Date(schedule.slot.end) : null
    if (!selectedStart) {
      return null
    }

    const durationMinutes = Number.parseInt(blockedDurationMinutes, 10)

    if (!durationMinutes) {
      return null
    }

    const endDateTime = new Date(selectedStart)
    endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes)
    return endDateTime
  }, [blockedDurationMinutes, mode, selectedService?.duration_minutes, selectedStart, schedule.slot])

  const conflict = useMemo(() => {
    if (mode !== "blocked" || !selectedStart || !selectedEnd || form.staff_ids.length === 0) {
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
    if (!eligibleStaff.some(member => member.id === staffId)) return
    setForm(current => ({ ...current, staff_ids: current.staff_ids.includes(staffId)
      ? current.staff_ids.filter(id => id !== staffId) : [...current.staff_ids, staffId] }))
  }

  const handleClientFieldChange = (field: "phone" | "first_name" | "last_name", value: string) => {
    setForm((current) => ({
      ...current,
      client_id: "",
      client_pack_id: "",
      [field]: value,
    }))
    setClientSearchTerm(value)
  }

  const handleSelectClientSuggestion = (client: Client) => {
    setForm((current) => ({
      ...current,
      client_id: client.id,
      client_pack_id: "",
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      phone: client.phone || "",
      email: client.email || "",
    }))
    setClientSearchTerm("")
    setDebouncedClientSearchTerm("")
  }

  const normalizePhone = (phone: string) => phone.replace(/[\s\u00A0\-\.\(\)\/]/g, "").trim()
  const normalizedPhone = normalizePhone(form.phone)
  const normalizedEmail = form.email.trim().toLowerCase()
  const clientPackSearchTerm = normalizedEmail || normalizedPhone || `${form.first_name} ${form.last_name}`.trim()

  const { data: clientPacks, isFetching: isFetchingClientPacks } = useQuery({
    queryKey: ["quick-create-client-packs", form.client_id, clientPackSearchTerm, form.service_id],
    queryFn: () => fetchAPI<ClientPack[]>(`/client-packs?search=${encodeURIComponent(clientPackSearchTerm)}`),
    enabled:
      mode === "appointment" &&
      form.payment_method === "pack" &&
      Boolean(form.service_id) &&
      Boolean(form.client_id || clientPackSearchTerm),
    staleTime: 20 * 1000,
  })

  const eligibleClientPacks = useMemo(() => {
    if (!clientPacks || !form.service_id) {
      return []
    }

    return clientPacks.filter((clientPack) => {
      const client = clientPack.client
      const sameClient =
        (form.client_id && client?.id === form.client_id) ||
        (normalizedEmail && client?.email?.toLowerCase() === normalizedEmail) ||
        (normalizedPhone && normalizePhone(client?.phone || "") === normalizedPhone)

      return Boolean(
        sameClient &&
          clientPack.remaining_sessions > 0 &&
          canUseClientPackStatus(clientPack.payment_status) &&
          clientPack.pack?.allowed_services?.includes(form.service_id)
      )
    })
  }, [clientPacks, form.client_id, form.service_id, normalizedEmail, normalizedPhone])

  const { data: validatedGiftCard, isFetching: isValidatingGiftCard, isError: giftCardHasError } = useQuery({
    queryKey: ["quick-create-gift-card", form.gift_card_code],
    queryFn: () => fetchAPI<ValidatedGiftCard>(`/gift-cards/validate?code=${encodeURIComponent(form.gift_card_code)}`),
    enabled:
      mode === "appointment" &&
      form.payment_method === "gift_card" &&
      form.gift_card_code.replace(/[^a-zA-Z0-9]/g, "").length >= 6,
    retry: false,
    staleTime: 10 * 1000,
  })

  const giftCardMatchesService = Boolean(
    validatedGiftCard &&
      form.service_id &&
      validatedGiftCard.service_id === form.service_id
  )

  const updatePaymentMethod = (payment_method: QuickPaymentMethod) => {
    setForm((current) => ({
      ...current,
      payment_method,
      client_pack_id: payment_method === "pack" ? current.client_pack_id : "",
      gift_card_code: payment_method === "gift_card" ? current.gift_card_code : "",
    }))
  }

  const validatedClient = ClientDataSchema.safeParse({
    first_name: form.first_name, last_name: form.last_name, phone: form.phone, email: form.email || undefined,
  })
  const contactErrors = validatedClient.success ? {} : validatedClient.error.flatten().fieldErrors
  const hasRequiredFields = Boolean(
    selectedStart &&
      (mode === "blocked" ? timeOptions.length > 0 && form.staff_ids.length > 0 && form.staff_ids.every(id => eligibleStaff.some(member => member.id === id)) : schedule.isValid) &&
      (
        mode === "blocked"
          ? selectedEnd
          : form.service_id &&
            validatedClient.success &&
            (
              form.payment_method === "on_site" ||
              (form.payment_method === "pack" && form.client_pack_id) ||
              (form.payment_method === "gift_card" && giftCardMatchesService)
            )
      )
  )
  const canSubmit = hasRequiredFields && !conflict && !isSaving && !createAppointment.isPending && !isRedeemingGiftCard

  const handleSubmit = async () => {
    if (submitting.current) return
    if (!selectedStart || !hasRequiredFields || conflict) {
      toast.error(conflict ? "Ce blocage chevauche un rendez-vous existant." : "Complétez le soin, le créneau, l’équipe et les informations client.")
      return
    }
    if (selectedStart.getTime() < Date.now()) {
      toast.error("Choisissez un créneau à venir.")
      if (mode === "appointment") {
        schedule.clear("Ce créneau est passé. Choisissez un nouvel horaire.")
        void schedule.refresh()
      }
      return
    }
    submitting.current = true
    setIsSaving(true)
    try {
      const fresh = mode === "appointment" ? await schedule.refreshSelection() : null
      if (mode === "appointment" && !fresh) {
        void reloadServices()
        toast.error("Les disponibilités ont changé. Choisissez parmi les créneaux actualisés.")
        return
      }
      const bookingStart = fresh?.slot.start || selectedStart.toISOString()
      const staffIds = fresh?.staffIds || form.staff_ids
      const clientData = validatedClient.success ? validatedClient.data : undefined
      if (mode === "appointment" && form.payment_method === "gift_card") {
        setIsRedeemingGiftCard(true)
        await fetchAPI("/gift-cards/redeem", {
          method: "POST",
          body: JSON.stringify({
            code: form.gift_card_code, salon_id: salonId, service_id: form.service_id,
            start_time: bookingStart, staff_ids: staffIds,
            client_data: clientData,
            client_notes: form.notes || undefined,
          }),
        })
        await Promise.all(["appointments", "availability", "clients"].map(key => queryClient.invalidateQueries({ queryKey: [key] })))
        toast.success("Rendez-vous créé avec la carte cadeau")
      } else {
        await createAppointment.mutateAsync(mode === "blocked" ? {
          salon_id: salonId, staff_ids: staffIds, staff_id: staffIds[0],
          start_time: bookingStart, end_time: selectedEnd?.toISOString(),
          notes: form.notes || "Créneau bloqué depuis le calendrier", status: "blocked",
          payment_status: "unpaid", payment_method: "on_site",
        } : {
          salon_id: salonId, service_id: form.service_id, staff_ids: staffIds, staff_id: staffIds[0],
          start_time: bookingStart,
          client_data: clientData,
          client_notes: form.notes, status: "confirmed", booking_source: "admin",
          payment_method: form.payment_method === "pack" ? "pack" : "on_site",
          payment_status: form.payment_method === "pack" ? "paid" : "unpaid",
          amount_paid_cents: form.payment_method === "pack" ? selectedService?.price_cents || 0 : 0,
          client_pack_id: form.payment_method === "pack" ? form.client_pack_id : undefined,
        })
      }
      onClose()
      onSuccess?.()
    } catch (error) {
      if (error instanceof APIError && (error.status === 409 || (error.status === 400 && error.message !== "Validation error"))) {
        schedule.clear("Ce choix n’est plus disponible. Vos informations client sont conservées ; choisissez un nouveau créneau.")
        void schedule.refresh()
        if (error.status === 400) void reloadServices()
      }
      // Appointment mutations already display their error through the shared hook.
      if (form.payment_method === "gift_card" || !(error instanceof APIError)) {
        toast.error(error instanceof Error ? error.message : "Impossible de vérifier le créneau. Réessayez.")
      }
    } finally {
      submitting.current = false
      setIsSaving(false)
      setIsRedeemingGiftCard(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[740px]">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {mode === "blocked" ? "Bloquer un créneau" : "Ajouter un rendez-vous"}
          </DialogTitle>
          <DialogDescription>
            {mode === "blocked"
              ? "Empêcher toute réservation sur ce créneau."
              : "Choisissez le soin et le jour, puis un créneau et son équipe disponible."}
          </DialogDescription>
        </DialogHeader>

        <div data-slot="appointment-form-body" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <fieldset disabled={isSaving} className="min-w-0 space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={mode === "appointment" ? "default" : "outline"}
            onClick={() => { setMode("appointment"); schedule.clear() }}
          >
            Rendez-vous
          </Button>
          <Button
            type="button"
            variant={mode === "blocked" ? "default" : "outline"}
            onClick={() => { setMode("blocked"); schedule.clear() }}
          >
            Bloquer un créneau
          </Button>
        </div>

        <div className="space-y-5 py-2">
          {mode === "appointment" ? <>
            <section className="space-y-2 rounded-xl border p-4">
              <Label htmlFor="quick-service" className="text-sm font-semibold">1. Le soin</Label>
              <Select value={form.service_id} disabled={isSaving || servicesLoading || servicesError}
                onValueChange={value => setForm(current => ({ ...current, service_id: value, client_pack_id: "" }))}>
                <SelectTrigger id="quick-service"><SelectValue placeholder={servicesLoading ? "Chargement des soins…" : "Choisir un soin"} /></SelectTrigger>
                <SelectContent>{services?.map(service => <SelectItem key={service.id} value={service.id}>
                  {service.name} · {service.duration_minutes} min · {service.price_cents / 100} €
                </SelectItem>)}</SelectContent>
              </Select>
              {selectedService && <p className="text-xs text-muted-foreground">{selectedServiceRequiredStaffCount === 1 ? "Une masseuse" : `${selectedServiceRequiredStaffCount} masseuses`} pendant {selectedService.duration_minutes} minutes. Les créneaux tiennent compte de toute la durée.</p>}
              {servicesError && <div role="alert" className="text-sm text-destructive">Impossible de charger les soins. <Button type="button" variant="link" onClick={() => void reloadServices()}>Réessayer</Button></div>}
            </section>
            <AppointmentSchedulePicker schedule={schedule} disabled={isSaving} onDateChange={value => setSelectedDate(new Date(`${value}T12:00:00`))} />
          </> : <div className="space-y-4 rounded-xl border p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="block-date">Date</Label><Input id="block-date" type="date" min={todayInParis} value={format(selectedDate, "yyyy-MM-dd")}
                onChange={event => { if (event.target.value) setSelectedDate(new Date(`${event.target.value}T12:00:00`)) }} /></div>
              <div className="space-y-2"><Label htmlFor="block-time">Heure de début</Label><Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="block-time"><SelectValue placeholder="Choisir une heure" /></SelectTrigger>
                <SelectContent>{timeOptions.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent>
              </Select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="block-duration">Durée du blocage</Label><Select value={blockedDurationMinutes} onValueChange={setBlockedDurationMinutes}>
              <SelectTrigger id="block-duration"><SelectValue /></SelectTrigger><SelectContent>{blockedDurationOptions.map(duration => <SelectItem key={duration} value={String(duration)}>{duration} min</SelectItem>)}</SelectContent>
            </Select></div>
            <div className="space-y-2"><Label>Masseuses à bloquer</Label><div className="flex flex-wrap gap-2">
              {eligibleStaff.map(member => <Button key={member.id} type="button" variant={form.staff_ids.includes(member.id) ? "default" : "outline"}
                aria-pressed={form.staff_ids.includes(member.id)} onClick={() => toggleStaffSelection(member.id)}>{getStaffDisplayName(member)}</Button>)}
            </div></div>
          </div>}

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
                  4. Informations client
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-first_name">Prénom *</Label>
                  <Input
                    id="quick-first_name"
                    value={form.first_name}
                    onChange={(e) => handleClientFieldChange("first_name", e.target.value)}
                    placeholder="Prénom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-last_name">Nom *</Label>
                  <Input
                    id="quick-last_name"
                    value={form.last_name}
                    onChange={(e) => handleClientFieldChange("last_name", e.target.value)}
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-phone">Téléphone *</Label>
                  <Input
                    id="quick-phone"
                    type="tel"
                    autoComplete="tel"
                    aria-invalid={Boolean(form.phone && contactErrors.phone)}
                    aria-describedby={form.phone && contactErrors.phone ? "quick-phone-error" : undefined}
                    value={form.phone}
                    onChange={(e) => handleClientFieldChange("phone", e.target.value)}
                    placeholder="06..."
                  />
                  {form.phone && contactErrors.phone && <p id="quick-phone-error" className="text-xs text-destructive">{contactErrors.phone[0]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-email">Email</Label>
                  <Input
                    type="email"
                    id="quick-email"
                    aria-invalid={Boolean(form.email && contactErrors.email)}
                    aria-describedby={form.email && contactErrors.email ? "quick-email-error" : undefined}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="client@email.com"
                  />
                  {form.email && contactErrors.email && <p id="quick-email-error" className="text-xs text-destructive">{contactErrors.email[0]}</p>}
                </div>
              </div>

              <ClientSuggestionList
                visible={debouncedClientSearchTerm.length >= 2 || clientSearchTerm.trim().length >= 2}
                clients={clientSuggestions}
                isLoading={isFetchingClientSuggestions}
                onSelect={handleSelectClientSuggestion}
              />

              <div className="space-y-3 rounded-lg border border-primary/10 bg-muted/30 p-3">
                <Label>Paiement</Label>
                <Select value={form.payment_method} onValueChange={(value: QuickPaymentMethod) => updatePaymentMethod(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un mode de paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_site">Paiement sur place</SelectItem>
                    <SelectItem value="pack">Utiliser un forfait / abonnement</SelectItem>
                    <SelectItem value="gift_card">Utiliser une carte cadeau</SelectItem>
                  </SelectContent>
                </Select>

                {form.payment_method === "pack" ? (
                  <div className="space-y-2">
                    <Label>Forfait client</Label>
                    <Select
                      value={form.client_pack_id}
                      onValueChange={(value) => setForm({ ...form, client_pack_id: value })}
                      disabled={!form.service_id || eligibleClientPacks.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isFetchingClientPacks
                              ? "Recherche des forfaits..."
                              : eligibleClientPacks.length > 0
                                ? "Choisir le forfait à consommer"
                                : "Aucun forfait compatible trouvé"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleClientPacks.map((clientPack) => (
                          <SelectItem key={clientPack.id} value={clientPack.id}>
                            {clientPack.pack?.name || "Forfait"} - {clientPack.remaining_sessions}/{clientPack.total_sessions} séance(s)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Sélectionnez le client et la prestation. Le rendez-vous consommera automatiquement une séance.
                    </p>
                  </div>
                ) : null}

                {form.payment_method === "gift_card" ? (
                  <div className="space-y-2">
                    <Label>Code carte cadeau</Label>
                    <Input
                      value={form.gift_card_code}
                      onChange={(e) => setForm({ ...form, gift_card_code: e.target.value })}
                      placeholder="XXXX-XXXX-XXXX"
                    />
                    {isValidatingGiftCard ? (
                      <p className="text-xs text-muted-foreground">Vérification de la carte...</p>
                    ) : validatedGiftCard ? (
                      <p className={giftCardMatchesService ? "text-xs text-green-700" : "text-xs text-destructive"}>
                        {giftCardMatchesService
                          ? `Carte valide pour ${validatedGiftCard.service?.name || "cette prestation"}.`
                          : `Carte valide, mais prévue pour ${validatedGiftCard.service?.name || "une autre prestation"}.`}
                      </p>
                    ) : giftCardHasError ? (
                      <p className="text-xs text-destructive">Carte cadeau introuvable ou déjà utilisée.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Le rendez-vous sera créé et la carte sera marquée comme utilisée.</p>
                    )}
                  </div>
                ) : null}
              </div>
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

        </fieldset>
        </div>
        <DialogFooter className="shrink-0 border-t bg-background px-5 py-4">
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {isSaving || createAppointment.isPending || isRedeemingGiftCard
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
