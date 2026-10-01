"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Calendar, Clock, User } from "lucide-react"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { useServices } from "@/lib/hooks/use-services"
import { useStaff } from "@/lib/hooks/use-staff"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { useClientSearch } from "@/lib/hooks/use-client-search"
import { fetchAPI } from "@/lib/api/client"
import { canUseClientPackStatus } from "@/lib/packs"
import {
  findOverlappingAppointment,
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
    client_id: "",
    service_id: "",
    staff_ids: [] as string[],
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
        client_id: "",
        service_id: "",
        staff_ids: [],
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        notes: "",
        payment_method: "on_site",
        client_pack_id: "",
        gift_card_code: "",
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
  const selectedServiceRequiredStaffCount = selectedService?.required_staff_count || 1
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
    return dateTimeInScheduleTimezone(selectedDate, `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
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
    } else if (mode === "blocked" || current.length < selectedServiceRequiredStaffCount) {
      setForm({ ...form, staff_ids: [...current, staffId] })
    }
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

  const hasRequiredFields = Boolean(
    selectedStart &&
      timeOptions.length > 0 &&
      (mode === "blocked" ? form.staff_ids.length > 0 : form.staff_ids.length === selectedServiceRequiredStaffCount) &&
      (
        mode === "blocked"
          ? selectedEnd
          : form.service_id &&
            form.first_name &&
            form.last_name &&
            form.phone &&
            (
              form.payment_method === "on_site" ||
              (form.payment_method === "pack" && form.client_pack_id) ||
              (form.payment_method === "gift_card" && giftCardMatchesService)
            )
      )
  )
  const canSubmit = hasRequiredFields && !conflict && !createAppointment.isPending && !isRedeemingGiftCard

  const handleSubmit = async () => {
    if (!selectedStart || !hasRequiredFields) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }
    if (selectedStart.getTime() < Date.now()) {
      toast.error("Impossible de créer un rendez-vous dans le passé")
      return
    }
    if (conflict) {
      toast.error("Conflit détecté: ce créneau chevauche un rendez-vous existant")
      return
    }

    if (mode === "appointment" && form.payment_method === "gift_card") {
      if (!giftCardMatchesService) {
        toast.error("La carte cadeau ne correspond pas à cette prestation")
        return
      }

      setIsRedeemingGiftCard(true)
      try {
        await fetchAPI("/gift-cards/redeem", {
          method: "POST",
          body: JSON.stringify({
            code: form.gift_card_code,
            salon_id: salonId,
            service_id: form.service_id,
            start_time: selectedStart.toISOString(),
            staff_ids: form.staff_ids,
            client_data: {
              first_name: form.first_name,
              last_name: form.last_name,
              phone: form.phone,
              email: form.email || undefined,
            },
            client_notes: form.notes || undefined,
          }),
        })
        toast.success("Rendez-vous créé avec la carte cadeau")
        onClose()
        onSuccess?.()
      } catch (error: any) {
        toast.error(error.message || "Impossible d'utiliser cette carte cadeau")
      } finally {
        setIsRedeemingGiftCard(false)
      }
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
            payment_method: form.payment_method === "pack" ? "pack" : "on_site",
            payment_status: form.payment_method === "pack" ? "paid" : "unpaid",
            amount_paid_cents: form.payment_method === "pack" ? selectedService?.price_cents || 0 : 0,
            client_pack_id: form.payment_method === "pack" ? form.client_pack_id : undefined,
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
                  onValueChange={(val) => setForm({ ...form, service_id: val, staff_ids: [], client_pack_id: "" })}
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
            <Select
              onValueChange={(val) => toggleStaffSelection(val)}
              disabled={mode === "appointment" && form.staff_ids.length >= selectedServiceRequiredStaffCount}
            >
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
            {mode === "appointment" && form.service_id ? (
              <p className="text-xs text-muted-foreground">
                Cette prestation nécessite {selectedServiceRequiredStaffCount} masseuse{selectedServiceRequiredStaffCount > 1 ? "s" : ""}.
              </p>
            ) : null}
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {createAppointment.isPending || isRedeemingGiftCard
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
