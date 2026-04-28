"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { StepIndicator } from "@/components/step-indicator"
import { useAvailability } from "@/lib/hooks/use-availability"
import { useStaff } from "@/lib/hooks/use-staff"
import { fetchAPI } from "@/lib/api/client"
import { formatGiftCardCode } from "@/lib/gift-cards"
import { CheckCircle2, Gift } from "lucide-react"
import { Icon } from "@iconify/react"
import { toast } from "sonner"
import { quarterOptionsBetween } from "@/lib/calendar/scheduling"
import type { Staff } from "@/lib/types/database"

type GiftCardStep = "salon" | "therapist" | "date" | "time" | "info"

type GiftCardValidationResponse = {
  id: string
  code: string
  status: "active" | "used" | "cancelled"
  service_id: string
  service: {
    id: string
    name: string
    description?: string | null
    duration_minutes: number
    price_cents: number
    required_staff_count?: number
    salons?: Array<{
      id: string
      name: string
      slug: string
      city: string
      address?: string | null
      phone?: string | null
    }>
  } | null
}

type AvailabilitySlot = {
  start: string
  end: string
  available_staff?: string[]
}

export default function RedeemGiftCardPage() {
  const router = useRouter()
  const formRef = useRef<HTMLDivElement | null>(null)
  const [codeInput, setCodeInput] = useState("")
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [giftCard, setGiftCard] = useState<GiftCardValidationResponse | null>(null)
  const [step, setStep] = useState<GiftCardStep>("salon")
  const [selectedSalonId, setSelectedSalonId] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [assignmentMode, setAssignmentMode] = useState<"specific" | "random">("specific")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [clientForm, setClientForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  })

  const { data: staff, isLoading: staffLoading } = useStaff(selectedSalonId || undefined)
  const requiredStaffCount = giftCard?.service?.required_staff_count || 1
  const isMultiStaff = requiredStaffCount > 1
  const isRandomAssignment = assignmentMode === "random"
  const bookableStaff = (staff || []).filter((member) => {
    const canTakeBookings = member.is_active && ["therapist", "manager", "admin"].includes(member.role)
    const allowedServiceIds = member.allowed_service_ids || []
    const canProvideService = !giftCard?.service_id || allowedServiceIds.length === 0 || allowedServiceIds.includes(giftCard.service_id)

    return canTakeBookings && canProvideService
  })
  const availabilitySelection = isMultiStaff
    ? (isRandomAssignment ? undefined : selectedEmployeeIds)
    : (isRandomAssignment ? undefined : selectedEmployeeId || undefined)
  const dateObject = selectedDate ? new Date(`${selectedDate}T00:00:00`) : undefined
  const { data: availabilityData, isLoading: isLoadingAvailability } = useAvailability(
    availabilitySelection,
    dateObject,
    giftCard?.service?.id,
    selectedSalonId || undefined
  )

  const compatibleSalons = giftCard?.service?.salons || []
  const availableTimesSet = useMemo(() => new Set(
    (availabilityData?.available_slots || []).map((slot) =>
      new Date(slot.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    ),
  ), [availabilityData?.available_slots])
  const timeOptions = useMemo(() => {
    const open = availabilityData?.salon_hours?.open
    const close = availabilityData?.salon_hours?.close
    if (open && close) {
      return quarterOptionsBetween(open, close)
    }
    return []
  }, [availabilityData?.salon_hours?.close, availabilityData?.salon_hours?.open])
  const stepLabels = [
    "Choisir un temple",
    "Choisir un thérapeute",
    "Choisir une date",
    "Choisir une heure",
    "Vos informations",
  ]
  const stepIndex = ["salon", "therapist", "date", "time", "info"].indexOf(step) + 1

  const selectedSalon = compatibleSalons.find((salon) => salon.id === selectedSalonId)
  const selectedBookableStaffIds = selectedEmployeeIds.filter((staffId) =>
    bookableStaff.some((member) => member.id === staffId)
  )
  const selectedBookableEmployee = bookableStaff.find((member) => member.id === selectedEmployeeId)
  const selectedStaffNames = isMultiStaff
    ? isRandomAssignment
      ? "Attribution automatique"
      : bookableStaff
          .filter((member) => selectedEmployeeIds.includes(member.id))
          .map((member) => `${member.first_name} ${member.last_name}`)
          .join(", ")
    : isRandomAssignment
      ? "Attribution automatique"
      : selectedBookableEmployee
        ? `${selectedBookableEmployee.first_name} ${selectedBookableEmployee.last_name}`
        : ""
  const today = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }), [])

  const renderStaffName = (employee: Pick<Staff, "first_name" | "last_name" | "gender">) => {
    const genderIcon =
      employee.gender === "female" ? "mdi:gender-female" : employee.gender === "male" ? "mdi:gender-male" : null

    return (
      <span className="inline-flex items-center gap-2">
        {genderIcon ? <Icon icon={genderIcon} className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
        <span>
          {employee.first_name} {employee.last_name}
        </span>
      </span>
    )
  }

  const getPreferredStaffIds = (availableStaffIds: string[], requiredCount: number) => {
    const sortByName = (a: Staff, b: Staff) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "fr")

    const availableStaff = bookableStaff
      .filter((member) => availableStaffIds.includes(member.id))

    const femaleStaff = availableStaff
      .filter((member) => member.gender === "female")
      .sort(sortByName)

    const fallbackStaff = availableStaff
      .filter((member) => member.gender !== "female")
      .sort(sortByName)

    return (femaleStaff.length > 0 ? femaleStaff : fallbackStaff)
      .slice(0, requiredCount)
      .map((member) => member.id)
  }

  const handleValidateCode = async () => {
    if (!codeInput.trim()) {
      toast.error("Renseigne un code cadeau.")
      return
    }

    setIsCheckingCode(true)
    try {
      const response = await fetchAPI<GiftCardValidationResponse>(`/gift-cards/validate?code=${encodeURIComponent(codeInput)}`)
      setGiftCard(response)
      setStep("salon")
      setSelectedSalonId("")
      setAssignmentMode("specific")
      setSelectedDate("")
      setSelectedEmployeeId("")
      setSelectedEmployeeIds([])
      setSelectedSlot(null)
      toast.success("Carte cadeau valide.")
    } catch (error: any) {
      setGiftCard(null)
      toast.error(error.message || "Code cadeau invalide.")
    } finally {
      setIsCheckingCode(false)
    }
  }

  const handleRedeem = async () => {
    if (!giftCard || !selectedSalonId || !selectedSlot || !clientForm.first_name || !clientForm.last_name || !clientForm.phone) {
      toast.error("Complète les informations nécessaires avant de confirmer.")
      return
    }

    const staffIds = isRandomAssignment
      ? getPreferredStaffIds(selectedSlot.available_staff || [], requiredStaffCount)
      : isMultiStaff
        ? selectedBookableStaffIds
        : (selectedBookableEmployee ? [selectedBookableEmployee.id] : [])

    if (staffIds.length < requiredStaffCount) {
      toast.error("Sélectionne le ou les praticiens requis.")
      return
    }

    const availableStaffIds = selectedSlot.available_staff || []
    if (staffIds.some((staffId) => !availableStaffIds.includes(staffId))) {
      toast.error("Le créneau sélectionné n'est plus disponible pour le ou les praticiens choisis.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchAPI<any>("/gift-cards/redeem", {
        method: "POST",
        body: JSON.stringify({
          code: giftCard.code,
          salon_id: selectedSalonId,
          service_id: giftCard.service_id,
          start_time: selectedSlot.start,
          staff_ids: staffIds,
          client_data: {
            first_name: clientForm.first_name,
            last_name: clientForm.last_name,
            phone: clientForm.phone,
            email: clientForm.email || undefined,
          },
          client_notes: clientForm.notes || undefined,
        }),
      })

      localStorage.setItem("lastBooking", JSON.stringify({
        reference: response.appointment.id,
        salon: selectedSalon,
        service: giftCard.service,
        start_time: response.appointment.start_time,
        client: {
          first_name: clientForm.first_name,
          last_name: clientForm.last_name,
          phone: clientForm.phone,
          email: clientForm.email,
        },
        notes: clientForm.notes,
      }))

      toast.success("Rendez-vous confirmé et carte cadeau utilisée.")
      router.push("/booking-success")
    } catch (error: any) {
      toast.error(error.message || "Impossible de réserver avec cette carte cadeau.")
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!selectedSlot) return

    const selectedTime = new Date(selectedSlot.start).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })

    if (!availableTimesSet.has(selectedTime)) {
      setSelectedSlot(null)
    }
  }, [availableTimesSet, selectedSlot])

  useEffect(() => {
    setSelectedSlot(null)
  }, [selectedSalonId, selectedDate, selectedEmployeeId, selectedEmployeeIds, assignmentMode])

  useEffect(() => {
    if (!giftCard) return

    if (!formRef.current) return

    const top = window.scrollY + formRef.current.getBoundingClientRect().top - 96
    window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" })
  }, [giftCard, step])

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((current) => {
      if (current.includes(employeeId)) {
        return current.filter((id) => id !== employeeId)
      }
      if (current.length >= requiredStaffCount) {
        return current
      }
      return [...current, employeeId]
    })
  }

  const goToNextStep = () => {
    const steps: GiftCardStep[] = ["salon", "therapist", "date", "time", "info"]
    const currentIndex = steps.indexOf(step)
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1])
    }
  }

  const goToPreviousStep = () => {
    const steps: GiftCardStep[] = ["salon", "therapist", "date", "time", "info"]
    const currentIndex = steps.indexOf(step)
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1])
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground">
              <Gift className="w-4 h-4" />
              Utiliser une carte cadeau
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-bold">J&apos;ai une carte cadeau</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Entre ton code, puis réserve ton soin en suivant le même ordre logique que le parcours classique.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <Label htmlFor="gift-code">Code cadeau</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="gift-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="ABCD-EFGH-IJKL"
              />
              <Button onClick={handleValidateCode} disabled={isCheckingCode} className="w-full sm:w-auto">
                {isCheckingCode ? "Vérification..." : "Vérifier"}
              </Button>
            </div>
          </Card>

          {giftCard && giftCard.service && (
            <div ref={formRef} className="max-w-2xl mx-auto scroll-mt-28">
              <StepIndicator currentStep={stepIndex} totalSteps={5} stepLabels={stepLabels} />

              <Card className="p-6 md:p-8 animate-in fade-in duration-300 space-y-6">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Carte cadeau valide</span>
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Prestation associée</p>
                  <p className="font-semibold text-lg">{giftCard.service.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {giftCard.service.duration_minutes} min • {(giftCard.service.price_cents / 100).toFixed(2)}€
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Code : {formatGiftCardCode(giftCard.code)}</p>
                </div>

                {step === "salon" && (
                  <>
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Choisir un temple</h2>
                      <p className="text-muted-foreground mb-6">Sélectionnez le salon dans lequel vous souhaitez utiliser votre carte cadeau.</p>
                      <RadioGroup value={selectedSalonId} onValueChange={(value) => {
                        setSelectedSalonId(value)
                        setAssignmentMode("specific")
                        setSelectedEmployeeId("")
                        setSelectedEmployeeIds([])
                        setSelectedDate("")
                        setSelectedSlot(null)
                      }}>
                        <div className="space-y-3">
                          {compatibleSalons.map((salon) => (
                            <div key={salon.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted hover:border-primary cursor-pointer transition-all">
                              <RadioGroupItem value={salon.id} id={salon.id} className="mt-1" />
                              <Label htmlFor={salon.id} className="flex-1 cursor-pointer">
                                <div className="font-semibold">{salon.name}</div>
                                <div className="text-sm text-muted-foreground">{salon.city}</div>
                                {salon.address && <div className="text-xs text-muted-foreground mt-1">{salon.address}</div>}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={goToNextStep} disabled={!selectedSalonId}>Suivant</Button>
                    </div>
                  </>
                )}

                {step === "therapist" && (
                  <>
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Choisir un thérapeute</h2>
                      <p className="text-muted-foreground mb-6">
                        {isMultiStaff
                          ? `Sélectionnez ${requiredStaffCount} praticiens pour cette prestation.`
                          : "Sélectionnez le praticien souhaité."}
                      </p>
                      {staffLoading ? (
                        <div className="text-sm text-muted-foreground">Chargement des praticiens...</div>
                      ) : bookableStaff.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Aucun praticien disponible dans ce salon.</div>
                      ) : !isMultiStaff ? (
                        <RadioGroup value={isRandomAssignment ? "random" : selectedEmployeeId} onValueChange={(value) => {
                          if (value === "random") {
                            setAssignmentMode("random")
                            setSelectedEmployeeId("")
                            return
                          }
                          setAssignmentMode("specific")
                          setSelectedEmployeeId(value)
                        }}>
                          <div className="space-y-3">
                            <div
                              className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                                isRandomAssignment
                                  ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                                  : "bg-card/65 hover:bg-muted hover:border-primary"
                              }`}
                              onClick={() => {
                                setAssignmentMode("random")
                                setSelectedEmployeeId("")
                              }}
                            >
                              <Label htmlFor="gift-random-employee" className="pointer-events-none flex cursor-pointer items-start gap-3">
                                <RadioGroupItem value="random" id="gift-random-employee" className="mt-1 shrink-0 pointer-events-none" />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-base font-medium text-foreground">Aléatoire</span>
                                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                                    Nous attribuons automatiquement un praticien disponible sur le créneau choisi, avec priorité absolue aux femmes disponibles.
                                  </span>
                                </span>
                              </Label>
                            </div>
                            {bookableStaff.map((member) => (
                              <div
                                key={member.id}
                                className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                                  selectedEmployeeId === member.id && !isRandomAssignment
                                    ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                                    : "bg-card/65 hover:bg-muted hover:border-primary"
                                }`}
                                onClick={() => {
                                  setAssignmentMode("specific")
                                  setSelectedEmployeeId(member.id)
                                }}
                              >
                                <Label htmlFor={`gift-staff-${member.id}`} className="pointer-events-none flex cursor-pointer items-start gap-3">
                                  <RadioGroupItem value={member.id} id={`gift-staff-${member.id}`} className="mt-1 shrink-0 pointer-events-none" />
                                  <span className="min-w-0 flex-1 text-base font-medium leading-6 text-foreground">
                                    {renderStaffName(member)}
                                  </span>
                                </Label>
                              </div>
                            ))}
                          </div>
                        </RadioGroup>
                      ) : (
                        <div className="space-y-3">
                          <div
                            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                              isRandomAssignment
                                ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                                : "bg-card/65 hover:bg-muted hover:border-primary"
                            }`}
                            onClick={() => {
                              setAssignmentMode("random")
                              setSelectedEmployeeIds([])
                            }}
                          >
                            <Label htmlFor="gift-random-employees" className="pointer-events-none flex cursor-pointer items-start gap-3">
                              <Checkbox checked={isRandomAssignment} onCheckedChange={() => {}} id="gift-random-employees" className="mt-1 pointer-events-none" />
                              <span className="min-w-0 flex-1">
                                <span className="block text-base font-medium text-foreground">Attribution automatique</span>
                                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                                  Nous choisirons les praticiens disponibles au moment du créneau, avec priorité absolue aux femmes disponibles.
                                </span>
                              </span>
                            </Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isRandomAssignment
                              ? "Attribution automatique sélectionnée"
                              : `Sélection actuelle: ${selectedEmployeeIds.length}/${requiredStaffCount}`}
                          </p>
                          {bookableStaff.map((member) => {
                            const isSelected = selectedEmployeeIds.includes(member.id)
                            const isFull = selectedEmployeeIds.length >= requiredStaffCount
                            const disabled = !isSelected && isFull

                            return (
                              <div
                                key={member.id}
                                className={`cursor-pointer rounded-2xl border p-4 transition-colors ${isSelected && !isRandomAssignment ? "border-primary bg-primary/12 shadow-[0_10px_24px_rgba(214,171,89,0.08)]" : "bg-card/65 hover:bg-muted"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                                onClick={() => {
                                  setAssignmentMode("specific")
                                  !disabled && toggleEmployeeSelection(member.id)
                                }}
                              >
                                <Label htmlFor={`gift-staff-${member.id}`} className="pointer-events-none flex cursor-pointer items-start gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => {}}
                                    id={`gift-staff-${member.id}`}
                                    className="mt-1 pointer-events-none"
                                  />
                                  <span className="min-w-0 flex-1 text-base font-medium leading-6 text-foreground">
                                    {renderStaffName(member)}
                                  </span>
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={goToPreviousStep}>Retour</Button>
                      <Button
                        onClick={goToNextStep}
                        disabled={(!isMultiStaff && !selectedBookableEmployee && !isRandomAssignment) || (isMultiStaff && !isRandomAssignment && selectedBookableStaffIds.length !== requiredStaffCount)}
                      >
                        Suivant
                      </Button>
                    </div>
                  </>
                )}

                {step === "date" && (
                  <>
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Choisir une date</h2>
                      <p className="text-muted-foreground mb-6">Sélectionnez la date souhaitée pour voir les créneaux disponibles.</p>
                      <Label htmlFor="gift-date" className="font-semibold">Sélectionner une date</Label>
                      <Input
                        id="gift-date"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={today}
                        className="mt-2 w-full min-w-0 max-w-full"
                      />
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={goToPreviousStep}>Retour</Button>
                      <Button onClick={goToNextStep} disabled={!selectedDate}>Suivant</Button>
                    </div>
                  </>
                )}

                {step === "time" && (
                  <>
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Choisir une heure</h2>
                      <p className="text-muted-foreground mb-6">Sélectionnez un créneau disponible.</p>
                      {isLoadingAvailability ? (
                        <p className="text-sm text-muted-foreground">Chargement des créneaux...</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {timeOptions.length ? timeOptions.map((time) => {
                            const slot = availabilityData?.available_slots?.find((candidate) =>
                              new Date(candidate.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) === time
                            )
                            const isAvailable = Boolean(slot)
                            const isSelected = selectedSlot?.start === slot?.start
                            return (
                              <Button
                                key={time}
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => slot && setSelectedSlot(slot)}
                                disabled={!isAvailable}
                                className={!isAvailable ? "bg-muted text-muted-foreground border-muted-foreground/10 opacity-100 cursor-not-allowed hover:bg-muted hover:text-muted-foreground" : undefined}
                              >
                                {time}
                              </Button>
                            )
                          }) : (
                            <p className="text-sm text-muted-foreground col-span-full">Aucun créneau disponible pour cette date.</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={goToPreviousStep}>Retour</Button>
                      <Button onClick={goToNextStep} disabled={!selectedSlot}>Suivant</Button>
                    </div>
                  </>
                )}

                {step === "info" && (
                  <>
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Vos informations</h2>
                      <p className="text-muted-foreground mb-6">Complétez vos informations pour confirmer le rendez-vous.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">Prénom *</Label>
                        <Input id="first_name" value={clientForm.first_name} onChange={(e) => setClientForm({ ...clientForm, first_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Nom *</Label>
                        <Input id="last_name" value={clientForm.last_name} onChange={(e) => setClientForm({ ...clientForm, last_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Téléphone *</Label>
                        <Input id="phone" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" rows={4} value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} />
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
                      <p><strong>Prestation:</strong> {giftCard.service.name}</p>
                      <p><strong>Salon:</strong> {selectedSalon?.name || "Aucun"}</p>
                      <p><strong>Praticien{isMultiStaff ? "s" : ""}:</strong> {selectedStaffNames || "Aucun"}</p>
                      <p><strong>Date:</strong> {selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("fr-FR") : "Aucune"}</p>
                      <p><strong>Heure:</strong> {selectedSlot ? new Date(selectedSlot.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Aucune"}</p>
                      <p><strong>Carte cadeau:</strong> {formatGiftCardCode(giftCard.code)}</p>
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={goToPreviousStep}>Retour</Button>
                      <Button onClick={handleRedeem} disabled={isSubmitting || !clientForm.first_name || !clientForm.last_name || !clientForm.phone}>
                        {isSubmitting ? "Confirmation..." : "Confirmer le rendez-vous"}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
