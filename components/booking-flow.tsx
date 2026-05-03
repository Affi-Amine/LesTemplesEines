"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { StepIndicator } from "@/components/step-indicator"
import { ServiceCatalog } from "@/components/service-catalog"
import { useSalons } from "@/lib/hooks/use-salons"
import { useServices } from "@/lib/hooks/use-services"
import { useStaff } from "@/lib/hooks/use-staff"
import { useAvailability } from "@/lib/hooks/use-availability"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { t } from "@/lib/i18n/get-translations"
import { toast } from "sonner"
import { Icon } from "@iconify/react"
import { useRouter, useSearchParams } from "next/navigation"
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz"
import type { Locale } from "@/i18n.config"
import { quarterOptionsBetween } from "@/lib/calendar/scheduling"
import { fetchAPI } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import type { ClientPack, Staff } from "@/lib/types/database"
import { canUseClientPackStatus } from "@/lib/packs"

type BookingStep = "salon" | "service" | "time" | "info" | "confirm"

interface BookingData {
  salon: string
  service: string
  employee: string
  employees: string[] // For multi-staff selection
  assignmentMode: "specific" | "random"
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [step, setStep] = useState<BookingStep>(initialSalon ? "service" : "salon")
  const [data, setData] = useState<BookingData>({
    salon: initialSalon || "",
    service: "",
    employee: "",
    employees: [],
    assignmentMode: "specific",
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
  const todayInParis = useMemo(() => formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd"), [])

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
      assignmentMode: "specific",
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
      assignmentMode: "specific",
      date: "",
      time: "",
    }))
  }

  const handleEmployeeChange = (employeeId: string) => {
    setData((current) => ({
      ...current,
      assignmentMode: "specific",
      employee: employeeId,
      employees: [],
      time: "",
    }))
  }

  const handleRandomAssignment = () => {
    setData((current) => ({
      ...current,
      assignmentMode: "random",
      employee: "",
      employees: [],
      time: "",
    }))
  }

  const handleDateChange = (date: string) => {
    if (date && date < todayInParis) {
      toast.error("Impossible de réserver dans le passé")
      return
    }

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
  const salonEmployees = (staff || []).filter((employee) => {
    const canTakeBookings = employee.is_active && ["therapist", "manager", "admin"].includes(employee.role)
    const allowedServiceIds = employee.allowed_service_ids || []
    const canProvideService = !currentService || allowedServiceIds.length === 0 || allowedServiceIds.includes(currentService.id)

    return canTakeBookings && canProvideService
  })
  const currentEmployee = salonEmployees.find((e) => e.id === data.employee)
  const selectedEmployees = salonEmployees.filter((employee) => data.employees.includes(employee.id))
  const isRandomAssignment = data.assignmentMode === "random"
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

  const isMultiStaff = (currentService?.required_staff_count || 1) > 1
  const availabilitySelection =
    isRandomAssignment
      ? undefined
      : isMultiStaff
        ? data.employees
        : data.employee
          ? [data.employee]
          : undefined

  // Availability based on selected therapist and date
  const selectedDateObj = data.date ? new Date(data.date) : undefined
  const { data: availabilityData, isLoading: availabilityLoading } = useAvailability(
    availabilitySelection,
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
  const availableEmployeesForSelectedTime = useMemo(() => {
    const availableStaffIds = new Set(getStaffForSelectedTime())
    return salonEmployees.filter((employee) => availableStaffIds.has(employee.id))
  }, [availabilityData?.available_slots, data.time, salonEmployees])

  const getPreferredStaffIds = (availableStaffIds: string[], requiredCount: number) => {
    const sortByName = (a: Staff, b: Staff) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "fr")

    const availableEmployees = salonEmployees
      .filter((employee) => availableStaffIds.includes(employee.id))

    const femaleEmployees = availableEmployees
      .filter((employee) => employee.gender === "female")
      .sort(sortByName)

    const fallbackEmployees = availableEmployees
      .filter((employee) => employee.gender !== "female")
      .sort(sortByName)

    return (femaleEmployees.length > 0 ? femaleEmployees : fallbackEmployees)
      .slice(0, requiredCount)
      .map((employee) => employee.id)
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
      setData((current) => ({
        ...current,
        time: "",
      }))
    }
  }, [availableTimesSet, data.time])

  useEffect(() => {
    if (!data.employee || isRandomAssignment || !data.time || !availabilityData?.available_slots) {
      return
    }

    const isStillAvailable = availableEmployeesForSelectedTime.some((employee) => employee.id === data.employee)

    if (!isStillAvailable) {
      setData((current) => ({
        ...current,
        employee: "",
      }))
    }
  }, [availabilityData?.available_slots, availableEmployeesForSelectedTime, data.employee, data.time, isRandomAssignment])

  useEffect(() => {
    if (data.employees.length === 0 || isRandomAssignment || !data.time || !availabilityData?.available_slots) {
      return
    }

    const availableEmployeeIds = new Set(availableEmployeesForSelectedTime.map((employee) => employee.id))
    const nextEmployees = data.employees.filter((employeeId) => availableEmployeeIds.has(employeeId))

    if (nextEmployees.length !== data.employees.length) {
      setData((current) => ({
        ...current,
        employees: nextEmployees,
      }))
    }
  }, [availabilityData?.available_slots, availableEmployeesForSelectedTime, data.employees, data.time, isRandomAssignment])

  useEffect(() => {
    if (!containerRef.current) return

    const top = window.scrollY + containerRef.current.getBoundingClientRect().top - 96
    window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" })
  }, [step])

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
    setData((current) => ({ ...current, employees: newSelection }))
  }

  const handleTimeChange = (time: string) => {
    setData((current) => ({
      ...current,
      time,
    }))
  }

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
    
    if (!currentSalon || !currentService || (!currentEmployee && !isMultiStaff && !isRandomAssignment)) {
      toast.error("Erreur", {
        description: "Veuillez remplir tous les champs requis",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    // Convert Paris time to UTC ISO string
    const parisTime = fromZonedTime(`${data.date} ${data.time}:00`, "Europe/Paris")
    const startTime = parisTime.toISOString()
    const nowInParis = toZonedTime(new Date(), "Europe/Paris")
    const selectedStartInParis = toZonedTime(new Date(startTime), "Europe/Paris")

    if (selectedStartInParis.getTime() < nowInParis.getTime()) {
      toast.error("Impossible de réserver un créneau dans le passé")
      return
    }
    
    // For multi-staff, get the assigned staff from availability data
    let assignedStaffIds: string[] = []
    let primaryStaffId = currentEmployee?.id

    if (isRandomAssignment) {
      const requiredCount = currentService.required_staff_count || 1
      const preferredStaffIds = getPreferredStaffIds(getStaffForSelectedTime(), requiredCount)

      if (preferredStaffIds.length < requiredCount) {
        toast.error("Aucun praticien disponible pour ce créneau", {
          description: "Choisissez un autre créneau ou un autre praticien.",
          icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
        })
        return
      }

      assignedStaffIds = preferredStaffIds
      primaryStaffId = preferredStaffIds[0]
    } else if (isMultiStaff) {
      // If user selected specific employees, use them. Otherwise auto-assign (fallback)
      // But since we are implementing manual selection now, we prefer data.employees if valid
      
      const requiredCount = currentService.required_staff_count || 1
      
      if (data.employees.length === requiredCount) {
         // User selected manually
         assignedStaffIds = data.employees
      } else {
         // Fallback to auto-assignment if user didn't select or selected fewer (should be blocked by UI validation ideally)
         // But for now let's keep auto-assign as backup or if they chose "Any"
         const preferredStaffIds = getPreferredStaffIds(getStaffForSelectedTime(), requiredCount)
         if (preferredStaffIds.length < requiredCount) {
            toast.error("Erreur", {
              description: "Plus assez de personnel disponible pour ce créneau.",
              icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
            })
            return
         }
         assignedStaffIds = preferredStaffIds
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

    const assignedStaff = salonEmployees.find((employee) => employee.id === primaryStaffId) || currentEmployee

    const bookingDetails = {
      salon: currentSalon,
      service: currentService,
      staff: assignedStaff,
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
        booking_source: "client",
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

          router.push("/booking-success")
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

  const renderStaffName = (employee: Pick<Staff, "first_name" | "last_name" | "gender">) => {
    const genderIcon =
      employee.gender === "female" ? "mdi:gender-female" : employee.gender === "male" ? "mdi:gender-male" : null

    return (
      <span className="inline-flex items-center gap-2">
        {genderIcon && <Icon icon={genderIcon} className="h-4 w-4 text-primary" aria-hidden="true" />}
        <span>
          {employee.first_name} {employee.last_name}
        </span>
      </span>
    )
  }

  const isTherapistSelectionComplete =
    isRandomAssignment ||
    (!isMultiStaff && !!currentEmployee) ||
    (isMultiStaff && selectedEmployees.length === (currentService?.required_staff_count || 1))
  const flowCardClass = "animate-in fade-in duration-300 gap-3 border-0 bg-transparent px-0 py-0 shadow-none sm:gap-6 sm:rounded-xl sm:border sm:border-primary/10 sm:bg-card/70 sm:p-6 md:p-8"
  const flowTitleClass = "mb-1 text-[1.12rem] font-semibold leading-tight sm:text-2xl"
  const flowSubtitleClass = "mb-3 text-[0.82rem] leading-5 text-muted-foreground sm:mb-6 sm:text-base sm:leading-6"
  const flowActionsClass = "mt-4 flex flex-col-reverse gap-2.5 sm:mt-8 sm:flex-row sm:justify-between"

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-2xl px-0 pb-2 pt-2 sm:p-4 scroll-mt-28">
      <StepIndicator currentStep={stepIndex} totalSteps={5} stepLabels={stepLabels} />

      {/* Step 1: Select Salon */}
      {step === "salon" && (
        <Card className={flowCardClass}>
          <h2 className={flowTitleClass}>{t(locale, "booking.step1_title")}</h2>
          <p className={flowSubtitleClass}>{t(locale, "booking.step1_subtitle")}</p>

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
              <div className="space-y-2">
                {salons?.map((salon) => (
                  <div
                    key={salon.id}
                    onClick={() => handleSalonChange(salon.id)}
                    className={`rounded-xl border px-3 py-2.5 transition-all cursor-pointer sm:rounded-[1.35rem] sm:p-5 ${
                      data.salon === salon.id
                        ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                        : "bg-card/65 hover:bg-muted hover:border-primary"
                    }`}
                  >
                    <Label htmlFor={salon.id} className="block cursor-pointer pointer-events-none">
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={salon.id} id={salon.id} className="mt-1 shrink-0 pointer-events-none" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[0.92rem] font-semibold leading-tight break-words text-foreground sm:text-[1.35rem]">
                            {salon.name}
                          </div>
                          <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
                            <p className="text-xs leading-5 break-words text-muted-foreground sm:text-[0.95rem] sm:leading-6">
                              {salon.address}
                            </p>
                            <p className="text-xs font-medium text-foreground/90 sm:text-sm">
                              {salon.city}
                            </p>
                            {salon.phone ? (
                              <div className="pt-1">
                                <span className="inline-flex w-fit rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary whitespace-nowrap sm:px-3 sm:py-1 sm:text-xs">
                                  {salon.phone}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          <div className="mt-4 flex flex-col-reverse gap-2.5 sm:mt-8 sm:flex-row sm:justify-end">
            <Button onClick={handleNext} disabled={!data.salon || salonsLoading} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Select Service */}
      {step === "service" && (
        <Card className={flowCardClass}>
          <h2 className={flowTitleClass}>{t(locale, "booking.step2_title")}</h2>
          <p className={flowSubtitleClass}>{t(locale, "booking.step2_subtitle")}</p>

          {selectedClientPack ? (
            <div className="mb-4 rounded-xl border border-primary/15 bg-primary/8 p-3.5 sm:mb-6 sm:rounded-2xl sm:p-5">
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
            <ServiceCatalog
              services={servicesWithPackInfo}
              selectedServiceId={data.service}
              onSelectService={handleServiceChange}
              compact
              getBadge={(service) => {
                if (!selectedClientPack) return null
                return selectedPackAllowedServiceIds.has(service.id) ? "Inclus dans votre forfait" : "Hors forfait"
              }}
            />
          )}

          <div className={flowActionsClass}>
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
        <Card className={flowCardClass}>
          <h2 className={flowTitleClass}>{t(locale, "booking.step3_title")}</h2>
          <p className={flowSubtitleClass}>{t(locale, "booking.step3_subtitle")}</p>
          <div className="space-y-5 sm:space-y-6">
            <div>
              {(!currentService?.required_staff_count || currentService.required_staff_count <= 1) ? (
                <div className="mb-5 sm:mb-6">
                  <Label className="text-sm font-semibold sm:text-base">{t(locale, "booking.select_therapist")}</Label>
                  <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground sm:mt-2 sm:text-xs">
                    Choisissez votre praticien avant de voir les créneaux, ou laissez-nous choisir pour vous.
                  </p>
                  {staffLoading ? (
                    <div className="mt-3 space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="rounded-lg border p-3 animate-pulse">
                          <div className="h-4 w-1/3 rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <RadioGroup value={isRandomAssignment ? "random" : data.employee} onValueChange={(value) => {
                      if (value === "random") {
                        handleRandomAssignment()
                        return
                      }
                      handleEmployeeChange(value)
                    }}>
                      <div className="mt-2.5 space-y-2 sm:mt-3 sm:space-y-3">
                        <div
                          onClick={handleRandomAssignment}
                          className={`cursor-pointer rounded-xl border px-3 py-2.5 transition-all sm:rounded-2xl sm:p-4 ${
                            isRandomAssignment
                              ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                              : "bg-card/65 hover:bg-muted hover:border-primary"
                          }`}
                        >
                          <Label htmlFor="booking-random-employee" className="pointer-events-none flex cursor-pointer items-start gap-3">
                            <RadioGroupItem value="random" id="booking-random-employee" className="mt-1 shrink-0 pointer-events-none" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-foreground sm:text-base">Aléatoire</span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                                Nous attribuons automatiquement un praticien disponible sur le créneau choisi, avec priorité absolue aux femmes disponibles.
                              </span>
                            </span>
                          </Label>
                        </div>
                        {salonEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            onClick={() => handleEmployeeChange(emp.id)}
                            className={`cursor-pointer rounded-xl border px-3 py-2.5 transition-all sm:rounded-2xl sm:p-4 ${
                              data.employee === emp.id && !isRandomAssignment
                                ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                                : "bg-card/65 hover:bg-muted hover:border-primary"
                            }`}
                          >
                            <Label htmlFor={emp.id} className="pointer-events-none flex cursor-pointer items-start gap-3">
                              <RadioGroupItem value={emp.id} id={emp.id} className="mt-1 shrink-0 pointer-events-none" />
                              <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground sm:text-base sm:leading-6">
                                {renderStaffName(emp)}
                              </span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </div>
              ) : (
                <div className="mb-5 sm:mb-6">
                  <Label className="text-sm font-semibold sm:text-base">
                    Sélectionnez {currentService.required_staff_count} praticiens
                    {data.employees.length > 0 && !isRandomAssignment && ` (${data.employees.length}/${currentService.required_staff_count})`}
                  </Label>
                  <p className="mb-2.5 mt-1.5 text-[11px] leading-5 text-muted-foreground sm:mb-3 sm:mt-2 sm:text-xs">
                    Choisissez d'abord vos praticiens, ou laissez-nous faire l'attribution automatique sur le créneau choisi.
                  </p>
                  <div
                    onClick={handleRandomAssignment}
                    className={`mb-2.5 cursor-pointer rounded-xl border px-3 py-2.5 transition-all sm:mb-3 sm:rounded-2xl sm:p-4 ${
                      isRandomAssignment
                        ? "border-primary bg-primary/10 shadow-[0_10px_24px_rgba(214,171,89,0.08)]"
                        : "bg-card/65 hover:bg-muted hover:border-primary"
                    }`}
                  >
                    <Label htmlFor="booking-random-employees" className="pointer-events-none flex cursor-pointer items-start gap-3">
                      <Checkbox
                        checked={isRandomAssignment}
                        onCheckedChange={() => {}}
                        id="booking-random-employees"
                        className="mt-1 pointer-events-none"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground sm:text-base">Attribution automatique</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                          Nous choisirons les praticiens disponibles au moment du créneau, avec priorité absolue aux femmes disponibles.
                        </span>
                      </span>
                    </Label>
                  </div>
                  {staffLoading ? (
                    <div className="mt-3 space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="rounded-lg border p-3 animate-pulse">
                          <div className="h-4 w-1/3 rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2.5 space-y-2 sm:mt-3 sm:space-y-3">
                      {salonEmployees.map((emp) => {
                        const isSelected = data.employees.includes(emp.id)
                        const isFull = data.employees.length >= (currentService.required_staff_count || 2)
                        const disabled = !isSelected && isFull

                        return (
                          <div
                            key={emp.id}
                            className={`cursor-pointer rounded-xl border px-3 py-2.5 transition-colors sm:rounded-2xl sm:p-4 ${isSelected && !isRandomAssignment ? "border-primary bg-primary/12 shadow-[0_10px_24px_rgba(214,171,89,0.08)]" : "bg-card/65 hover:bg-muted"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                            onClick={() => {
                              setData((current) => ({ ...current, assignmentMode: "specific", time: "" }))
                              !disabled && toggleEmployeeSelection(emp.id, currentService.required_staff_count || 2)
                            }}
                          >
                            <Label htmlFor={`staff-${emp.id}`} className="pointer-events-none flex cursor-pointer items-start gap-3">
                              <Checkbox
                                checked={isSelected && !isRandomAssignment}
                                onCheckedChange={() => {}}
                                id={`staff-${emp.id}`}
                                className="mt-1 pointer-events-none"
                              />
                              <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground sm:text-base sm:leading-6">
                                {renderStaffName(emp)}
                              </span>
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <Label htmlFor="date" className="text-sm font-semibold sm:text-base">
                {t(locale, "booking.select_date")}
              </Label>
              <Input
                id="date"
                type="date"
                value={data.date}
                onChange={(e) => handleDateChange(e.target.value)}
                min={todayInParis}
                className="mt-2 h-10 w-full min-w-0 max-w-full text-sm sm:h-11"
                disabled={!isTherapistSelectionComplete}
              />
              {!isTherapistSelectionComplete ? (
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground sm:mt-2 sm:text-xs">
                  Choisissez d'abord un praticien ou l'option aléatoire pour voir les créneaux.
                </p>
              ) : null}
            </div>
            <div>
              <Label className="text-sm font-semibold sm:text-base">{t(locale, "booking.select_time")}</Label>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground sm:mt-2 sm:text-xs">
                {!isTherapistSelectionComplete && "Choisissez d'abord un praticien ou l'option aléatoire."}
                {isTherapistSelectionComplete && !data.date && "Sélectionnez d'abord la date pour voir les créneaux disponibles."}
                {availabilityLoading && data.date && "Chargement des créneaux disponibles..."}
              </p>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:mt-3 sm:grid-cols-3 sm:gap-2 md:grid-cols-4">
                {timeOptions.map((time) => {
                  const isAvailable = data.date ? availableTimesSet.has(time) : false
                  const isSelected = data.time === time
                  return (
                    <Button
                      key={time}
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => handleTimeChange(time)}
                      className={`h-9 w-full rounded-lg text-xs font-medium sm:h-12 sm:rounded-xl sm:text-sm ${!isAvailable ? "bg-muted text-muted-foreground border-muted-foreground/10 opacity-100 cursor-not-allowed hover:bg-muted hover:text-muted-foreground" : ""}`}
                      disabled={!isTherapistSelectionComplete || !isAvailable || availabilityLoading}
                    >
                      {time}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className={flowActionsClass}>
            <Button variant="outline" onClick={handlePrev} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.back")}
            </Button>
            <Button onClick={handleNext} disabled={!data.date || !data.time || !isTherapistSelectionComplete} size="lg" className="cursor-pointer w-full sm:w-auto">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Enter Info */}
      {step === "info" && (
        <Card className={flowCardClass}>
          <h2 className={flowTitleClass}>{t(locale, "booking.step4_title")}</h2>
          <p className={flowSubtitleClass}>{t(locale, "booking.step4_subtitle")}</p>
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
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 transition-all sm:rounded-2xl sm:p-4 ${
                    data.paymentOption === "stripe"
                      ? "border-primary bg-primary/10"
                      : "bg-card/65 hover:bg-muted hover:border-primary"
                  }`}
                >
                  <Label htmlFor="payment-stripe" className="pointer-events-none flex cursor-pointer items-start gap-3">
                    <RadioGroupItem value="stripe" id="payment-stripe" className="mt-1 shrink-0 pointer-events-none" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium sm:text-base">Payer maintenant</div>
                      <div className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">Paiement en ligne sécurisé avec Stripe.</div>
                    </div>
                  </Label>
                </div>
                <div
                  onClick={() => eligiblePacks.length > 0 && updateData({ paymentOption: "pack" })}
                  className={`rounded-xl border px-3 py-2.5 transition-all sm:rounded-2xl sm:p-4 ${
                    data.paymentOption === "pack"
                      ? "border-primary bg-primary/10"
                      : "bg-card/65 hover:bg-muted hover:border-primary"
                  } ${eligiblePacks.length === 0 ? "opacity-50" : "cursor-pointer"}`}
                >
                  <Label htmlFor="payment-pack" className="pointer-events-none flex cursor-pointer items-start gap-3">
                    <RadioGroupItem value="pack" id="payment-pack" className="mt-1 shrink-0 pointer-events-none" disabled={eligiblePacks.length === 0} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium sm:text-base">Utiliser un forfait</div>
                      <div className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                        {eligiblePacks.length > 0
                          ? `${eligiblePacks.length} forfait(s) compatible(s) disponible(s).`
                          : "Aucun forfait utilisable pour cette prestation. Les forfaits impayés ou bloqués ne sont pas proposés."}
                      </div>
                    </div>
                  </Label>
                </div>
                {data.paymentOption === "pack" && eligiblePacks.length > 0 && (
                  <div className="space-y-2 sm:pl-3">
                    {eligiblePacks.map((clientPack) => (
                      <div
                        key={clientPack.id}
                        onClick={() => updateData({ clientPackId: clientPack.id })}
                        className={`cursor-pointer rounded-xl border p-3 ${data.clientPackId === clientPack.id ? "border-primary bg-primary/10" : "bg-card/65"}`}
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
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 transition-all sm:rounded-2xl sm:p-4 ${
                    data.paymentOption === "on_site"
                      ? "border-primary bg-primary/10"
                      : "bg-card/65 hover:bg-muted hover:border-primary"
                  }`}
                >
                  <Label htmlFor="payment-on-site" className="pointer-events-none flex cursor-pointer items-start gap-3">
                    <RadioGroupItem value="on_site" id="payment-on-site" className="mt-1 shrink-0 pointer-events-none" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium sm:text-base">Payer sur place</div>
                      <div className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">Le rendez-vous est créé comme non payé.</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <div className={flowActionsClass}>
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
        <Card className={flowCardClass}>
          <h2 className={flowTitleClass}>{t(locale, "booking.step5_title")}</h2>
          <p className={flowSubtitleClass}>{t(locale, "booking.step5_subtitle")}</p>

          {/* Booking Summary */}
          <div className="mb-4 space-y-3 rounded-xl border border-border/70 bg-card/55 p-3 sm:mb-6 sm:space-y-4 sm:rounded-2xl sm:p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 sm:gap-4">
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">{t(locale, "booking.step1_title")}</p>
                <p className="text-sm font-semibold sm:text-lg">{currentSalon?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">{t(locale, "booking.step2_title")}</p>
                <p className="text-sm font-semibold sm:text-lg">{currentService?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">{t(locale, "booking.duration")}</p>
                <p className="text-sm font-semibold sm:text-lg">
                  {currentService?.duration_minutes} min
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">{t(locale, "booking.select_therapist")}</p>
                {selectedEmployees.length > 0 ? (
                  <div className="space-y-2">
                    {selectedEmployees.map((employee) => (
                      <p key={employee.id} className="text-sm font-semibold break-words sm:text-lg">
                        {renderStaffName(employee)}
                      </p>
                    ))}
                  </div>
                ) : currentEmployee ? (
                  <p className="text-sm font-semibold break-words sm:text-lg">{renderStaffName(currentEmployee)}</p>
                ) : (
                  <p className="text-sm font-semibold break-words sm:text-lg">Attribution automatique</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">{t(locale, "booking.step3_title")}</p>
                <p className="text-sm font-semibold sm:text-lg">
                  {new Date(data.date).toLocaleDateString("fr-FR")} à {data.time}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">{t(locale, "booking.step4_title")}</p>
                <p className="text-sm font-semibold sm:text-lg">
                  {data.firstName} {data.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">Paiement</p>
                <p className="text-sm font-semibold sm:text-lg">
                  {data.paymentOption === "stripe" ? "Stripe" : data.paymentOption === "pack" ? "Forfait" : "Sur place"}
                </p>
              </div>
            </div>

            {/* Price */}
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold sm:text-lg">{t(locale, "booking.price")}</span>
              <span className="text-xl font-bold text-primary sm:text-2xl">{currentService ? (currentService.price_cents / 100).toFixed(2) : '0.00'}€</span>
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
