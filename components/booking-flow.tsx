"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { StepIndicator } from "@/components/step-indicator"
import { useSalons } from "@/lib/hooks/use-salons"
import { useServices } from "@/lib/hooks/use-services"
import { useStaff } from "@/lib/hooks/use-staff"
import { useAvailability } from "@/lib/hooks/use-availability"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { t } from "@/lib/i18n/get-translations"
import { toast } from "sonner"
import { Icon } from "@iconify/react"
import { useRouter, useSearchParams } from "next/navigation"
import { fromZonedTime } from "date-fns-tz"
import type { Locale } from "@/i18n.config"
import { quarterOptionsBetween } from "@/lib/calendar/scheduling"
import { fetchAPI } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import type { ClientPack } from "@/lib/types/database"
import { canUseClientPackStatus } from "@/lib/packs"

type BookingStep = "salon" | "service" | "time" | "info" | "confirm"

interface BookingData {
  salon: string
  service: string
  employee: string
  employees: string[] // For multi-staff selection
  date: string
  time: string
  firstName: string
  lastName: string
  phone: string
  email: string
  notes: string
  paymentOption: "stripe" | "on_site" | "pack"
  clientPackId: string
}

interface BookingFlowProps {
  initialSalon?: string
  locale?: Locale
}

export function BookingFlow({ initialSalon, locale = "fr" }: BookingFlowProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<BookingStep>(initialSalon ? "service" : "salon")
  const [data, setData] = useState<BookingData>({
    salon: initialSalon || "",
    service: "",
    employee: "",
    employees: [],
    date: "",
    time: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
    paymentOption: "on_site",
    clientPackId: searchParams.get("client_pack_id") || "",
  })
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false)
  const [hasClientSession, setHasClientSession] = useState(false)

  const updateData = (updates: Partial<BookingData>) => {
    setData((current) => ({ ...current, ...updates }))
  }

  const handleSalonChange = (salonId: string) => {
    setData((current) => ({
      ...current,
      salon: salonId,
      service: "",
      employee: "",
      employees: [],
      date: "",
      time: "",
    }))
  }

  const handleServiceChange = (serviceId: string) => {
    setData((current) => ({
      ...current,
      service: serviceId,
      employee: "",
      employees: [],
      date: "",
      time: "",
    }))
  }

  const handleEmployeeChange = (employeeId: string) => {
    setData((current) => ({
      ...current,
      employee: employeeId,
      time: "",
    }))
  }

  const handleDateChange = (date: string) => {
    setData((current) => ({
      ...current,
      date,
      time: "",
    }))
  }

  // Fetch data using hooks
  const { data: salons, isLoading: salonsLoading } = useSalons()
  const { data: services, isLoading: servicesLoading } = useServices(data.salon || undefined)
  const { data: staff, isLoading: staffLoading } = useStaff(data.salon || undefined)
  const createAppointment = useCreateAppointment()

  useEffect(() => {
    createClient().auth.getUser().then(({ data: authData }) => {
      if (authData.user?.email) {
        setHasClientSession(true)
        setData((current) => ({
          ...current,
          email: current.email || authData.user?.email || "",
        }))
      }
    })
  }, [])

  const { data: clientPacks } = useQuery({
    queryKey: ["booking-client-packs"],
    queryFn: () => fetchAPI<ClientPack[]>("/client-packs/me"),
    enabled: hasClientSession,
  })

  // Find current selections
  const currentSalon = salons?.find((s) => s.id === data.salon || s.slug === data.salon)
  const currentService = services?.find((s) => s.id === data.service)
  const currentEmployee = staff?.find((e) => e.id === data.employee)
  const salonEmployees = staff || []
  const defaultClientProfile = useMemo(
    () => clientPacks?.find((clientPack) => clientPack.client)?.client || null,
    [clientPacks]
  )
  const selectedClientPack = (clientPacks || []).find((clientPack) => clientPack.id === data.clientPackId)
  const selectedPackAllowedServiceIds = useMemo(
    () => new Set(selectedClientPack?.pack?.allowed_services || []),
    [selectedClientPack?.pack?.allowed_services]
  )
  const servicesWithPackInfo = useMemo(() => {
    const serviceList = services || []

    if (!selectedClientPack) {
      return serviceList
    }

    return [...serviceList].sort((a, b) => {
      const aIncluded = selectedPackAllowedServiceIds.has(a.id)
      const bIncluded = selectedPackAllowedServiceIds.has(b.id)

      if (aIncluded === bIncluded) return 0
      return aIncluded ? -1 : 1
    })
  }, [selectedClientPack, selectedPackAllowedServiceIds, services])
  const eligiblePacks = (clientPacks || []).filter((clientPack) =>
    clientPack.remaining_sessions > 0 &&
    canUseClientPackStatus(clientPack.payment_status) &&
    clientPack.pack?.allowed_services?.includes(data.service)
  )

  useEffect(() => {
    if (!defaultClientProfile) {
      return
    }

    setData((current) => ({
      ...current,
      firstName: current.firstName || defaultClientProfile.first_name || "",
      lastName: current.lastName || defaultClientProfile.last_name || "",
      phone: current.phone || defaultClientProfile.phone || "",
      email: current.email || defaultClientProfile.email || "",
    }))
  }, [defaultClientProfile])

  useEffect(() => {
    if (!data.clientPackId || !selectedClientPack) {
      return
    }

    if (!data.service) {
      return
    }

    const isEligibleForSelectedService =
      selectedClientPack.remaining_sessions > 0 &&
      canUseClientPackStatus(selectedClientPack.payment_status) &&
      selectedClientPack.pack?.allowed_services?.includes(data.service)

    if (!isEligibleForSelectedService) {
      setData((current) => ({
        ...current,
        clientPackId: "",
        paymentOption: current.paymentOption === "pack" ? "on_site" : current.paymentOption,
      }))
    }
  }, [data.clientPackId, data.service, selectedClientPack])

  useEffect(() => {
    if (!data.clientPackId || !selectedClientPack || !data.service) {
      return
    }

    const isEligibleForSelectedService =
      selectedClientPack.remaining_sessions > 0 &&
      canUseClientPackStatus(selectedClientPack.payment_status) &&
      selectedClientPack.pack?.allowed_services?.includes(data.service)

    if (isEligibleForSelectedService && data.paymentOption !== "pack") {
      setData((current) => ({
        ...current,
        paymentOption: "pack",
      }))
    }
  }, [data.clientPackId, data.paymentOption, data.service, selectedClientPack])

  // Availability based on selected therapist and date
  const selectedDateObj = data.date ? new Date(data.date) : undefined
  const { data: availabilityData, isLoading: availabilityLoading } = useAvailability(
    (data.employees.length > 0 ? data.employees : (data.employee ? data.employee : undefined)),
    selectedDateObj,
    data.service || undefined,
    data.salon || undefined,
  )

  // Derive available start times (HH:mm) for quick lookup
  const availableTimesSet = useMemo(() => new Set(
    (availabilityData?.available_slots || []).map((slot) =>
      new Date(slot.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    ),
  ), [availabilityData?.available_slots])

  // Helper to get staff for selected slot in multi-staff scenario
  const getStaffForSelectedTime = () => {
    if (!data.time || !availabilityData?.available_slots) return []
    const selectedSlot = availabilityData.available_slots.find(slot => 
      new Date(slot.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) === data.time
    )
    return selectedSlot?.available_staff || []
  }

  // Generate time options from salon hours with 15-min steps if available, otherwise fallback
  const defaultTimes = [
    "09:00",
    "09:15",
    "09:30",
    "09:45",
    "10:00",
    "10:15",
    "10:30",
    "10:45",
    "11:00",
  ]
  const timeOptions = useMemo(() => {
    const open = availabilityData?.salon_hours?.open
    const close = availabilityData?.salon_hours?.close
    if (open && close) {
      return quarterOptionsBetween(open, close)
    }
    return defaultTimes
  }, [availabilityData?.salon_hours?.close, availabilityData?.salon_hours?.open])

  useEffect(() => {
    if (data.time && !availableTimesSet.has(data.time)) {
      setData((current) => ({ ...current, time: "" }))
    }
  }, [availableTimesSet, data.time])

  // Handle toggle for multi-staff selection
  const toggleEmployeeSelection = (employeeId: string, requiredCount: number) => {
    let newSelection = [...data.employees]
    if (newSelection.includes(employeeId)) {
      newSelection = newSelection.filter(id => id !== employeeId)
    } else {
      if (newSelection.length < requiredCount) {
        newSelection.push(employeeId)
      } else {
         // Replace the first one if limit reached (optional UX choice, or just block)
         // Let's block for now or maybe replace last? Let's just block adding more than needed
         // Actually better UX: if full, don't add. User must unselect first.
         // Or: Shift. remove first, add new.
         // Let's keep it simple: if not full, add.
         if (newSelection.length >= requiredCount) return
      }
    }
    setData((current) => ({ ...current, employees: newSelection, time: "" }))
  }

  const isMultiStaff = (currentService?.required_staff_count || 1) > 1

  const handleNext = () => {
    const steps: BookingStep[] = ["salon", "service", "time", "info", "confirm"]
    const currentIndex = steps.indexOf(step)
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1])
    }
  }

  const handlePrev = () => {
    const steps: BookingStep[] = ["salon", "service", "time", "info", "confirm"]
    const currentIndex = steps.indexOf(step)
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1])
    }
  }

  const handleConfirm = async () => {
    // If multi-staff, we don't need currentEmployee, but we need dynamic staff assignment
    // const isMultiStaff = (currentService?.required_staff_count || 1) > 1 // Defined above now
    
    if (!currentSalon || !currentService || (!currentEmployee && !isMultiStaff)) {
      toast.error("Erreur", {
        description: "Veuillez remplir tous les champs requis",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    // Convert Paris time to UTC ISO string
    const parisTime = fromZonedTime(`${data.date} ${data.time}:00`, "Europe/Paris")
    const startTime = parisTime.toISOString()
    
    // For multi-staff, get the assigned staff from availability data
    let assignedStaffIds: string[] = []
    let primaryStaffId = currentEmployee?.id

    if (isMultiStaff) {
      // If user selected specific employees, use them. Otherwise auto-assign (fallback)
      // But since we are implementing manual selection now, we prefer data.employees if valid
      
      const requiredCount = currentService.required_staff_count || 1
      
      if (data.employees.length === requiredCount) {
         // User selected manually
         assignedStaffIds = data.employees
      } else {
         // Fallback to auto-assignment if user didn't select or selected fewer (should be blocked by UI validation ideally)
         // But for now let's keep auto-assign as backup or if they chose "Any"
         const availableStaff = getStaffForSelectedTime()
         if (availableStaff.length < requiredCount) {
            toast.error("Erreur", {
              description: "Plus assez de personnel disponible pour ce créneau.",
              icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
            })
            return
         }
         assignedStaffIds = availableStaff.slice(0, requiredCount)
      }
      
      primaryStaffId = assignedStaffIds[0] // Use first one as primary for compatibility
    } else {
      assignedStaffIds = currentEmployee ? [currentEmployee.id] : []
    }

    if (!primaryStaffId) {
       toast.error("Erreur technique: Impossible d'assigner un prestataire.")
       return
    }

    if (data.paymentOption === "pack" && !data.clientPackId) {
      toast.error("Sélectionnez un forfait valide pour cette prestation.")
      return
    }

    const bookingDetails = {
      salon: currentSalon,
      service: currentService,
      staff: currentEmployee,
      start_time: startTime,
      client: {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email,
      },
      notes: data.notes,
      payment_option: data.paymentOption,
    }

    if (data.paymentOption === "stripe") {
      setIsRedirectingToStripe(true)
      localStorage.setItem("lastBooking", JSON.stringify(bookingDetails))

      try {
        const response = await fetchAPI<{ url: string }>("/stripe/checkout/appointment", {
          method: "POST",
          body: JSON.stringify({
            salon_id: currentSalon.id,
            staff_id: primaryStaffId,
            staff_ids: assignedStaffIds,
            service_id: currentService.id,
            start_time: startTime,
            client_data: {
              first_name: data.firstName,
              last_name: data.lastName,
              phone: data.phone,
              email: data.email || undefined,
            },
            notes: data.notes || undefined,
            payment_method: "stripe",
            payment_status: "pending",
          }),
        })

        window.location.href = response.url
        return
      } catch (error: any) {
        setIsRedirectingToStripe(false)
        toast.error("Erreur lors du paiement", {
          description: error.message || "Impossible de lancer le paiement Stripe.",
          icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
        })
        return
      }
    }

    createAppointment.mutate(
      {
        salon_id: currentSalon.id,
        staff_id: primaryStaffId,
        staff_ids: assignedStaffIds,
        service_id: currentService.id,
        start_time: startTime,
        client_data: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          email: data.email || undefined,
        },
        notes: data.notes || undefined,
        payment_method: data.paymentOption === "pack" ? "pack" : "on_site",
        payment_status: data.paymentOption === "pack" ? "paid" : "unpaid",
        amount_paid_cents: data.paymentOption === "pack" ? currentService.price_cents : 0,
        client_pack_id: data.paymentOption === "pack" ? data.clientPackId : undefined,
      },
      {
        onSuccess: (appointment) => {
          // Store booking details for success page
          const confirmedBookingDetails = {
            reference: appointment.id,
            ...bookingDetails,
          }
          localStorage.setItem("lastBooking", JSON.stringify(confirmedBookingDetails))

          toast.success(t(locale, "booking.booking_confirmed"), {
            description: "Un SMS de confirmation sera envoyé à " + data.phone,
            icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
            duration: 5000,
          })

          // Redirect to success page after 2 seconds
          setTimeout(() => {
            router.push("/booking-success")
          }, 2000)
        },
        onError: (error: any) => {
          toast.error("Erreur lors de la réservation", {
            description: error.message || "Une erreur est survenue",
            icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
          })
        },
      }
    )
  }

  const stepLabels = [
    t(locale, "booking.step1_title"),
    t(locale, "booking.step2_title"),
    t(locale, "booking.step3_title"),
    t(locale, "booking.step4_title"),
    t(locale, "booking.step5_title"),
  ]
  const stepIndex = ["salon", "service", "time", "info", "confirm"].indexOf(step) + 1

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <StepIndicator currentStep={stepIndex} totalSteps={5} stepLabels={stepLabels} />

      {/* Step 1: Select Salon */}
      {step === "salon" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step1_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step1_subtitle")}</p>

          {salonsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-lg animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <RadioGroup value={data.salon} onValueChange={handleSalonChange}>
              <div className="space-y-3">
                {salons?.map((salon) => (
                  <div
                    key={salon.id}
                    onClick={() => handleSalonChange(salon.id)}
                    className={`flex items-start space-x-3 rounded-lg border p-4 transition-all cursor-pointer ${
                      data.salon === salon.id
                        ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                        : "bg-card/65 hover:bg-muted hover:border-primary"
                    }`}
                  >
                    <RadioGroupItem value={salon.id} id={salon.id} className="mt-1 pointer-events-none" />
                    <Label htmlFor={salon.id} className="flex-1 cursor-pointer pointer-events-none">
                      <div className="font-semibold">{salon.name}</div>
                      <div className="text-sm text-muted-foreground">{salon.address}</div>
                      <div className="text-xs text-muted-foreground mt-1">{salon.phone}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-8">
            <Button onClick={handleNext} disabled={!data.salon || salonsLoading} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Select Service */}
      {step === "service" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step2_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step2_subtitle")}</p>

          {selectedClientPack ? (
            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/8 p-4 sm:p-5">
              <p className="text-sm font-semibold text-primary">Forfait sélectionné</p>
              <p className="mt-1 font-medium">{selectedClientPack.pack?.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Les prestations incluses apparaissent en premier avec le badge <span className="font-medium text-foreground">Inclus dans votre forfait</span>.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Si vous choisissez une prestation marquée <span className="font-medium text-foreground">Hors forfait</span>, vous devrez payer autrement.
              </p>
            </div>
          ) : null}

          {servicesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-lg animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : (
            <RadioGroup value={data.service} onValueChange={handleServiceChange}>
              <div className="space-y-3">
                {servicesWithPackInfo.map((service) => {
                  const isIncludedInSelectedPack = selectedClientPack ? selectedPackAllowedServiceIds.has(service.id) : false

                  return (
                    <div
                      key={service.id}
                      onClick={() => handleServiceChange(service.id)}
                      className={`rounded-[1.4rem] border p-4 transition-all cursor-pointer sm:p-5 ${
                        data.service === service.id
                          ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                          : "bg-card/65 hover:bg-muted hover:border-primary"
                      } ${selectedClientPack && !isIncludedInSelectedPack ? "border-dashed border-border/80" : ""}`}
                    >
                      <Label htmlFor={service.id} className="cursor-pointer pointer-events-none">
                        <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                          <div className="flex items-start gap-3">
                            <RadioGroupItem value={service.id} id={service.id} className="mt-1 shrink-0 pointer-events-none" />
                            <div className="min-w-0">
                              <div className="text-xl font-semibold leading-tight break-words text-foreground sm:text-[1.35rem]">
                                {service.name}
                              </div>
                              {selectedClientPack ? (
                                <div className="mt-3">
                                  <span
                                    className={`inline-flex w-fit rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                                      isIncludedInSelectedPack
                                        ? "border border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                                        : "border border-amber-300/20 bg-amber-500/10 text-amber-200"
                                    }`}
                                  >
                                    {isIncludedInSelectedPack ? "Inclus dans votre forfait" : "Hors forfait"}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="pl-9 sm:pl-0">
                            <div className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                              {service.description}
                            </div>
                          </div>

                          <div className="pl-9 sm:pl-0 sm:text-right">
                            <div className="text-sm text-muted-foreground">
                              {service.duration_minutes} min
                            </div>
                            <div className="mt-1 text-xl font-semibold text-primary">
                              {(service.price_cents / 100).toFixed(2)}€
                            </div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  )
                })}
              </div>
            </RadioGroup>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-8">
            <Button variant="outline" onClick={handlePrev} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.back")}
            </Button>
            <Button onClick={handleNext} disabled={!data.service || servicesLoading} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Select Time */}
      {step === "time" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step3_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step3_subtitle")}</p>
          <div className="space-y-6">
            {/* Select Therapist first to compute availability */}
            {(!currentService?.required_staff_count || currentService.required_staff_count <= 1) ? (
            <div>
              <Label className="font-semibold">{t(locale, "booking.select_therapist")}</Label>
              {staffLoading ? (
                <div className="space-y-2 mt-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="p-3 border rounded-lg animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3" />
                    </div>
                  ))}
                </div>
              ) : (
                <RadioGroup value={data.employee} onValueChange={handleEmployeeChange}>
                  <div className="space-y-2 mt-3">
                    {salonEmployees.length > 0 ? (
                      salonEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => handleEmployeeChange(emp.id)}
                          className={`flex items-center space-x-3 rounded-lg border p-3 transition-all cursor-pointer ${
                            data.employee === emp.id
                              ? "border-primary bg-primary/10"
                              : "bg-card/65 hover:bg-muted hover:border-primary"
                          }`}
                        >
                          <RadioGroupItem value={emp.id} id={emp.id} className="pointer-events-none" />
                          <Label htmlFor={emp.id} className="flex-1 cursor-pointer pointer-events-none">
                            {emp.first_name} {emp.last_name}
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucun thérapeute disponible</p>
                    )}
                  </div>
                </RadioGroup>
              )}
            </div>
            ) : (
              <div>
                 <Label className="font-semibold">
                   Sélectionnez {currentService.required_staff_count} praticiens
                   {data.employees.length > 0 && ` (${data.employees.length}/${currentService.required_staff_count})`}
                 </Label>
                 <p className="text-xs text-muted-foreground mb-3">
                   Veuillez choisir les praticiens pour ce soin duo ou trio. Laissez vide pour une attribution automatique.
                 </p>
                 
                 {staffLoading ? (
                    <div className="space-y-2 mt-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="p-3 border rounded-lg animate-pulse">
                          <div className="h-4 bg-muted rounded w-1/3" />
                        </div>
                      ))}
                    </div>
                 ) : (
                   <div className="space-y-2 mt-3">
                      {salonEmployees.map((emp) => {
                        const isSelected = data.employees.includes(emp.id)
                        const isFull = data.employees.length >= (currentService.required_staff_count || 2)
                        const disabled = !isSelected && isFull

                        return (
                          <div 
                            key={emp.id} 
                            className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-primary/12 border-primary' : 'bg-card/65 hover:bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !disabled && toggleEmployeeSelection(emp.id, currentService.required_staff_count || 2)}
                          >
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => {}}
                              id={`staff-${emp.id}`}
                              className="pointer-events-none"
                            />
                            <Label htmlFor={`staff-${emp.id}`} className="cursor-pointer flex-1 font-medium pointer-events-none">
                              {emp.first_name} {emp.last_name}
                            </Label>
                          </div>
                        )
                      })}
                   </div>
                 )}
              </div>
            )}
            <div>
              <Label htmlFor="date" className="font-semibold">
                {t(locale, "booking.select_date")}
              </Label>
                <Input
                  id="date"
                  type="date"
                  value={data.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="mt-2"
                />
            </div>
            <div>
              <Label className="font-semibold">{t(locale, "booking.select_time")}</Label>
              <p className="text-xs text-muted-foreground mt-2">
                {(!data.employee && (!currentService?.required_staff_count || currentService.required_staff_count <= 1) && !data.date) && "Sélectionnez d'abord le thérapeute et la date pour voir les créneaux disponibles."}
                {availabilityLoading && data.date && "Chargement des créneaux disponibles..."}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                {timeOptions.map((time) => {
                  const isAvailable = (data.employee || (currentService?.required_staff_count || 1) > 1) && data.date ? availableTimesSet.has(time) : false
                  const isSelected = data.time === time
                  return (
                    <Button
                      key={time}
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => updateData({ time })}
                      className={`w-full ${!isAvailable ? "bg-muted text-muted-foreground border-muted-foreground/10 opacity-100 cursor-not-allowed hover:bg-muted hover:text-muted-foreground" : ""}`}
                      disabled={!isAvailable || availabilityLoading || (!data.employee && (currentService?.required_staff_count || 1) <= 1)}
                    >
                      {time}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-8">
            <Button variant="outline" onClick={handlePrev} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.back")}
            </Button>
            <Button onClick={handleNext} disabled={!data.date || !data.time || (!data.employee && (currentService?.required_staff_count || 1) <= 1)} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Enter Info */}
      {step === "info" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step4_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step4_subtitle")}</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="font-semibold">
                  {t(locale, "booking.first_name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={data.firstName}
                  onChange={(e) => updateData({ firstName: e.target.value })}
                  className="mt-2"
                  placeholder="Jean"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="font-semibold">
                  {t(locale, "booking.last_name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={data.lastName}
                  onChange={(e) => updateData({ lastName: e.target.value })}
                  className="mt-2"
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone" className="font-semibold">
                {t(locale, "booking.phone")} <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-2">{t(locale, "booking.confirmation_sent")}</p>
              <Input
                id="phone"
                type="tel"
                value={data.phone}
                onChange={(e) => updateData({ phone: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email" className="font-semibold">
                {t(locale, "booking.email")} <span className="text-xs text-muted-foreground">(optionnel)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => updateData({ email: e.target.value })}
                className="mt-2"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="notes" className="font-semibold">
                {t(locale, "booking.notes")} <span className="text-xs text-muted-foreground">(optionnel)</span>
              </Label>
              <Textarea
                id="notes"
                value={data.notes}
                onChange={(e) => updateData({ notes: e.target.value })}
                placeholder="Ex: allergies, préférences, niveau de pression..."
                className="mt-2"
                rows={3}
              />
            </div>
            <div>
              <Label className="font-semibold">Paiement</Label>
              <RadioGroup
                value={data.paymentOption}
                onValueChange={(value: "stripe" | "on_site" | "pack") => updateData({ paymentOption: value })}
                className="mt-3 space-y-3"
              >
                <div
                  onClick={() => updateData({ paymentOption: "stripe" })}
                  className={`flex items-start space-x-3 rounded-lg border p-4 transition-all cursor-pointer ${
                    data.paymentOption === "stripe"
                      ? "border-primary bg-primary/10"
                      : "bg-card/65 hover:bg-muted hover:border-primary"
                  }`}
                >
                  <RadioGroupItem value="stripe" id="payment-stripe" className="mt-1 pointer-events-none" />
                  <Label htmlFor="payment-stripe" className="cursor-pointer flex-1 pointer-events-none">
                    <div className="font-medium">Payer maintenant</div>
                    <div className="text-sm text-muted-foreground">Paiement en ligne sécurisé avec Stripe.</div>
                  </Label>
                </div>
                <div
                  onClick={() => eligiblePacks.length > 0 && updateData({ paymentOption: "pack" })}
                  className={`flex items-start space-x-3 rounded-lg border p-4 transition-all ${
                    data.paymentOption === "pack"
                      ? "border-primary bg-primary/10"
                      : "bg-card/65 hover:bg-muted hover:border-primary"
                  } ${eligiblePacks.length === 0 ? "opacity-50" : "cursor-pointer"}`}
                >
                  <RadioGroupItem value="pack" id="payment-pack" className="mt-1 pointer-events-none" disabled={eligiblePacks.length === 0} />
                  <Label htmlFor="payment-pack" className="cursor-pointer flex-1 pointer-events-none">
                    <div className="font-medium">Utiliser un forfait</div>
                    <div className="text-sm text-muted-foreground">
                      {eligiblePacks.length > 0
                        ? `${eligiblePacks.length} forfait(s) compatible(s) disponible(s).`
                        : "Aucun forfait utilisable pour cette prestation. Les forfaits impayés ou bloqués ne sont pas proposés."}
                    </div>
                  </Label>
                </div>
                {data.paymentOption === "pack" && eligiblePacks.length > 0 && (
                  <div className="space-y-2 pl-3">
                    {eligiblePacks.map((clientPack) => (
                      <div
                        key={clientPack.id}
                        onClick={() => updateData({ clientPackId: clientPack.id })}
                        className={`rounded-lg border p-3 cursor-pointer ${data.clientPackId === clientPack.id ? "border-primary bg-primary/10" : "bg-card/65"}`}
                      >
                        <p className="font-medium break-words">{clientPack.pack?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {clientPack.remaining_sessions} / {clientPack.total_sessions} séance(s) restante(s)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  onClick={() => updateData({ paymentOption: "on_site" })}
                  className={`flex items-start space-x-3 rounded-lg border p-4 transition-all cursor-pointer ${
                    data.paymentOption === "on_site"
                      ? "border-primary bg-primary/10"
                      : "bg-card/65 hover:bg-muted hover:border-primary"
                  }`}
                >
                  <RadioGroupItem value="on_site" id="payment-on-site" className="mt-1 pointer-events-none" />
                  <Label htmlFor="payment-on-site" className="cursor-pointer flex-1 pointer-events-none">
                    <div className="font-medium">Payer sur place</div>
                    <div className="text-sm text-muted-foreground">Le rendez-vous est créé comme non payé.</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-8">
            <Button variant="outline" onClick={handlePrev} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.back")}
            </Button>
            <Button
              onClick={handleNext}
              disabled={!data.firstName || !data.lastName || !data.phone || (data.paymentOption === "pack" && !data.clientPackId)}
              size="lg"
              className="cursor-pointer w-full sm:w-auto"
            >
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 5: Confirmation */}
      {step === "confirm" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step5_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step5_subtitle")}</p>

          {/* Booking Summary */}
          <div className="space-y-4 bg-card/75 p-6 rounded-lg mb-6 border border-border/80">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.step1_title")}</p>
                <p className="font-semibold text-lg">{currentSalon?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.step2_title")}</p>
                <p className="font-semibold text-lg">{currentService?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.duration")}</p>
                <p className="font-semibold text-lg">
                  {currentService?.duration_minutes} min
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.select_therapist")}</p>
                <p className="font-semibold text-lg break-words">{currentEmployee?.first_name} {currentEmployee?.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.step3_title")}</p>
                <p className="font-semibold text-lg">
                  {new Date(data.date).toLocaleDateString("fr-FR")} à {data.time}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.step4_title")}</p>
                <p className="font-semibold text-lg">
                  {data.firstName} {data.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paiement</p>
                <p className="font-semibold text-lg">
                  {data.paymentOption === "stripe" ? "Stripe" : data.paymentOption === "pack" ? "Forfait" : "Sur place"}
                </p>
              </div>
            </div>

            {/* Price */}
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="font-semibold text-lg">{t(locale, "booking.price")}</span>
              <span className="text-2xl font-bold text-primary">{currentService ? (currentService.price_cents / 100).toFixed(2) : '0.00'}€</span>
            </div>
          </div>

          {/* Confirmation Info */}
          <div className="bg-accent/12 p-4 rounded-lg mb-6 border border-accent/30">
            <p className="text-sm">
              <strong>✓ {t(locale, "booking.confirmation_sent")}:</strong> {data.phone}
            </p>
            {data.email && (
              <p className="text-sm mt-2">
                <strong>✓ {t(locale, "booking.email")}:</strong> {data.email}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
            <Button variant="outline" onClick={handlePrev} size="lg" className="cursor-pointer w-full sm:w-auto" disabled={createAppointment.isPending}>
              {t(locale, "common.back")}
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-primary hover:bg-primary/90 cursor-pointer w-full sm:w-auto"
              size="lg"
              disabled={createAppointment.isPending || isRedirectingToStripe}
            >
              {createAppointment.isPending || isRedirectingToStripe ? (
                <>
                  <Icon icon="svg-spinners:ring-resize" className="w-5 h-5 mr-2" />
                  {isRedirectingToStripe ? "Redirection..." : t(locale, "common.loading")}
                </>
              ) : (
                data.paymentOption === "stripe"
                  ? "Payer avec Stripe"
                  : data.paymentOption === "pack"
                    ? "Réserver avec mon forfait"
                    : t(locale, "booking.confirm_booking")
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
