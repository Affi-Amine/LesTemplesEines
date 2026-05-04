"use client"

import { useEffect, useState } from "react"
import { AdminHeader } from "@/components/admin-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppointments } from "@/lib/hooks/use-appointments"
import { useStaff } from "@/lib/hooks/use-staff"
import { useSalons } from "@/lib/hooks/use-salons"
import { useParams } from "next/navigation"
import { format, addMinutes } from "date-fns"
import { fr } from "date-fns/locale"
import { toZonedTime, formatInTimeZone, fromZonedTime } from "date-fns-tz"
import { Clock, CheckCircle, Ban, Calendar as CalendarIcon, User, Plus, X, GripVertical } from "lucide-react"
import { toast } from "sonner"
import { Icon } from "@iconify/react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { useServices } from "@/lib/hooks/use-services"
import { useAvailability } from "@/lib/hooks/use-availability"
import { useClientSearch } from "@/lib/hooks/use-client-search"
import { DndContext, PointerSensor, TouchSensor, useSensors, useSensor, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core"
import { DraggableAppointment, DroppableSlot, QuickCreateModal } from "@/components/calendar"
import { ClientSuggestionList } from "@/components/client-suggestion-list"
import {
  findOverlappingAppointment,
  canStaffTakeBookings,
  getAppointmentDurationMinutes,
  getAppointmentStaffIds,
  getStaffDisplayName,
  getDefaultStartTimeForDate,
  getScheduleHourRange,
  minutesToTimeLabel,
  resolveOpeningHoursForDate,
  timeToMinutes,
} from "@/lib/calendar/scheduling"
import type { Client } from "@/lib/types/database"

import { useRouter } from "next/navigation"

const SCHEDULE_HOUR_HEIGHT = 76
const STAFF_COLUMN_MIN_WIDTH = 152
const TIME_COLUMN_WIDTH = 84

export default function SalonDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const salonId = params.id as string
  const [date, setDate] = useState<Date | undefined>(new Date())

  // Validate UUID
  const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  if (!isValidUUID(salonId)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <Ban className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold">Identifiant de salon invalide</h1>
          <p className="text-muted-foreground">
            L'identifiant fourni "{salonId}" n'est pas valide. Veuillez sélectionner un salon depuis la liste.
          </p>
          <Button onClick={() => router.push("/admin/salons")} className="cursor-pointer">
            Retourner à la liste des salons
          </Button>
        </div>
      </div>
    )
  }
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [isValidationOpen, setIsValidationOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isBlockingOpen, setIsBlockingOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Drag-and-drop state
  const [activeAppointment, setActiveAppointment] = useState<any>(null)
  const [pendingMove, setPendingMove] = useState<{
    appointment: any
    start: Date
    end: Date
    staffIds: string[]
  } | null>(null)
  const [isMovingAppointment, setIsMovingAppointment] = useState(false)
  const [replacingStaffId, setReplacingStaffId] = useState<string | null>(null)

  // Quick create modal state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [quickCreateData, setQuickCreateData] = useState<{
    date: Date
    hour: number
    minute: number
    staffId?: string
  } | null>(null)

  // Configure sensors for drag-and-drop (desktop + mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 5,
      },
    })
  )

  // Data fetching
  const { data: salons } = useSalons({ includeInactive: true })
  const { data: appointments, refetch: refetchAppointments } = useAppointments({
    salonId,
    startDate: date ? format(date, "yyyy-MM-dd") : undefined,
    endDate: date ? format(date, "yyyy-MM-dd") : undefined,
  })
  const { data: staff, isLoading: isStaffLoading } = useStaff(salonId)
  const { data: allStaff, isLoading: isAllStaffLoading } = useStaff()
  const { data: services } = useServices(salonId)
  const createAppointment = useCreateAppointment()

  const salon = salons?.find(s => s.id === salonId)
  const normalizeSalonValue = (value?: string | null) => value?.trim().toLowerCase() || ""
  const staffById = new Map<string, any>()
  ;[...(staff || []), ...(allStaff || [])].forEach((member) => {
    if (!member?.id) return
    if (staffById.has(member.id)) return
    if (member.salon_id === salonId) {
      staffById.set(member.id, member)
      return
    }

    const memberSalon = salons?.find((candidate) => candidate.id === member.salon_id)
    if (
      salon &&
      memberSalon &&
      (
        normalizeSalonValue(memberSalon.slug) === normalizeSalonValue(salon.slug) ||
        normalizeSalonValue(memberSalon.name) === normalizeSalonValue(salon.name)
      )
    ) {
      staffById.set(member.id, member)
    }
  })
  const dashboardStaff = Array.from(staffById.values())
  const selectedOpeningHours = salon?.opening_hours || null
  const selectedDayHours = date ? resolveOpeningHoursForDate(selectedOpeningHours, date) : null
  const scheduleHours = date ? getScheduleHourRange(selectedOpeningHours, date) : []
  const dayAppointments = appointments || []
  const bookableStaff = dashboardStaff.filter(canStaffTakeBookings).sort((a: any, b: any) =>
    getStaffDisplayName(a).localeCompare(getStaffDisplayName(b), "fr")
  )
  const scheduleMinWidth = TIME_COLUMN_WIDTH + Math.max(bookableStaff.length, 1) * STAFF_COLUMN_MIN_WIDTH
  const confirmedAppointments = dayAppointments.filter((apt: any) => apt.status === "confirmed" || apt.status === "pending")
  const inProgressAppointments = dayAppointments.filter((apt: any) => apt.status === "in_progress")
  const completedAppointments = dayAppointments.filter((apt: any) => apt.status === "completed")
  const blockedAppointments = dayAppointments.filter((apt: any) => apt.status === "blocked")
  const nextAppointment = confirmedAppointments
    .filter((apt: any) => new Date(apt.end_time).getTime() >= Date.now())
    .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]

  const [paymentLines, setPaymentLines] = useState<{method: string, amount: number}[]>([{ method: "card", amount: 0 }])

  const getDashboardStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmé"
      case "pending":
        return "Attente"
      case "in_progress":
        return "En cours"
      case "completed":
        return "Terminé"
      case "cancelled":
        return "Annulé"
      case "no_show":
        return "Absent"
      case "blocked":
        return "Bloqué"
      default:
        return status
    }
  }

  const getDashboardStatusClass = (status: string) => {
    switch (status) {
      case "confirmed":
        return "border-[#9cc9bf] bg-[#e8f6f2] text-[#0f4c43]"
      case "pending":
        return "border-[#c9d4d0] bg-[#f0f5f2] text-[#35514a]"
      case "in_progress":
        return "border-[#f4b740] bg-[#fff4cf] text-[#5c3d00]"
      case "completed":
        return "border-[#75c7a1] bg-[#e8f8ef] text-[#0b4936]"
      case "no_show":
        return "border-[#e6a36f] bg-[#fff3e8] text-[#74380d]"
      case "cancelled":
        return "border-[#f0a0a7] bg-[#fff0f1] text-[#7b1e2b]"
      case "blocked":
        return "border-stone-300 bg-stone-100 text-stone-800"
      default:
        return "border-border bg-muted text-muted-foreground"
    }
  }

  const getAppointmentStaffLabel = (appointment: any) => {
    const names = new Map<string, string>()
    if (appointment.staff?.id) {
      names.set(appointment.staff.id, getStaffDisplayName(appointment.staff))
    }
    appointment.assignments?.forEach((assignment: any) => {
      if (assignment.staff?.id) {
        names.set(assignment.staff.id, getStaffDisplayName(assignment.staff))
      }
    })

    return Array.from(names.values()).filter(Boolean).join(", ") || "Masseuse"
  }

  const handleValidate = async (appointment: any) => {
    setSelectedSlot(appointment)

    if (appointment.status === "blocked") {
      return
    }

    if (appointment.payment_status === "paid") {
      setIsDetailsOpen(true)
      return
    }

    handleOpenPayment(appointment)
  }

  const handleOpenPayment = (appointment = selectedSlot) => {
    if (!appointment) return
    const price = appointment.service?.price_cents ? appointment.service.price_cents / 100 : 0
    setSelectedSlot(appointment)
    setPaymentLines([{ method: "card", amount: price }])
    setIsDetailsOpen(false)
    setIsValidationOpen(true)
  }

  const isStaffAvailableForAppointment = (appointment: any, staffId: string) => {
    return !findOverlappingAppointment({
      appointments: appointments || [],
      staffId,
      start: new Date(appointment.start_time),
      end: new Date(appointment.end_time),
      ignoreAppointmentId: appointment.id,
    })
  }

  const handleReplaceAppointmentStaff = async (appointment: any, previousStaffId: string, nextStaffId: string) => {
    if (!appointment || previousStaffId === nextStaffId) return

    if (!isStaffAvailableForAppointment(appointment, nextStaffId)) {
      toast.error("Masseuse indisponible", {
        description: "Cette masseuse a déjà un rendez-vous sur ce créneau.",
      })
      return
    }

    const currentStaffIds = getAppointmentStaffIds(appointment)
    const nextStaffIds = currentStaffIds.map((staffId) => staffId === previousStaffId ? nextStaffId : staffId)

    if (new Set(nextStaffIds).size !== nextStaffIds.length) {
      toast.error("Masseuse déjà assignée")
      return
    }

    try {
      setReplacingStaffId(previousStaffId)
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: nextStaffIds[0],
          staff_ids: nextStaffIds,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Remplacement impossible")
      }

      const nextStaff = bookableStaff.find((member) => member.id === nextStaffId)
      toast.success("Masseuse remplacée", {
        description: nextStaff ? `${getStaffDisplayName(nextStaff)} est assignée au rendez-vous.` : undefined,
      })
      setIsDetailsOpen(false)
      refetchAppointments()
    } catch (error: any) {
      toast.error("Remplacement impossible", {
        description: error.message || "Réessayez",
      })
    } finally {
      setReplacingStaffId(null)
    }
  }

  const handleConfirmValidation = async () => {
    if (!selectedSlot) return

    const totalPaid = paymentLines.reduce((sum, line) => sum + line.amount, 0)
    const price = selectedSlot.service?.price_cents ? selectedSlot.service.price_cents / 100 : 0

    if (totalPaid !== price) {
      toast.error("Le montant total payé doit correspondre au prix du service")
      return
    }

    try {
      const response = await fetch(`/api/appointments/${selectedSlot.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_status: "paid",
          payment_method: paymentLines.length > 1 ? "mixed" : paymentLines[0].method,
          amount_paid_cents: totalPaid * 100,
          payments: paymentLines.map(line => ({
            method: line.method,
            amount_cents: line.amount * 100
          }))
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Erreur lors de la validation")
      }

      toast.success("Paiement validé", {
        description: "Le statut de prestation reste géré par la vue employée.",
      })
      setIsValidationOpen(false)
      refetchAppointments()
    } catch (error) {
      console.error("Validation error:", error)
      toast.error("Erreur lors de la validation")
    }
  }

  const addPaymentLine = () => {
    const currentTotal = paymentLines.reduce((sum, line) => sum + line.amount, 0)
    const price = selectedSlot?.service?.price_cents ? selectedSlot.service.price_cents / 100 : 0
    const remaining = Math.max(0, price - currentTotal)
    setPaymentLines([...paymentLines, { method: "cash", amount: remaining }])
  }

  const removePaymentLine = (index: number) => {
    if (paymentLines.length <= 1) return
    setPaymentLines(paymentLines.filter((_, i) => i !== index))
  }

  const updatePaymentLine = (index: number, field: 'method' | 'amount', value: any) => {
    const newLines = [...paymentLines]
    newLines[index] = { ...newLines[index], [field]: value }
    setPaymentLines(newLines)
  }

  const handleConfirmBlocking = async () => {
    if (!date || blockingForm.staff_ids.length === 0 || !blockingForm.startTime || !blockingForm.endTime) {
       toast.error("Veuillez remplir tous les champs")
       return
    }

    const startDateTime = new Date(date)
    const [startHour, startMinute] = blockingForm.startTime.split(':')
    startDateTime.setHours(parseInt(startHour), parseInt(startMinute))

    const endDateTime = new Date(date)
    const [endHour, endMinute] = blockingForm.endTime.split(':')
    endDateTime.setHours(parseInt(endHour), parseInt(endMinute))

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salon_id: salonId,
          staff_ids: blockingForm.staff_ids,
          staff_id: blockingForm.staff_ids[0], // Primary for compat
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "blocked",
          notes: blockingForm.notes
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors du blocage")
      }

      toast.success("Créneau bloqué avec succès")
      setIsBlockingOpen(false)
      setBlockingForm({
        staff_ids: [],
        startTime: "09:00",
        endTime: "10:00",
        notes: ""
      })
      refetchAppointments()
    } catch (error: any) {
      toast.error(error.message || "Impossible de bloquer le créneau")
    }
  }

  const handleCreateAppointment = async () => {
    if (!createForm.date || !createForm.startTime || !createForm.service_id || !createForm.first_name || !createForm.last_name || !createForm.phone) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    if (createForm.staff_ids.length !== selectedCreateRequiredStaffCount) {
      toast.error("Masseuses incomplètes", {
        description: `Cette prestation nécessite ${selectedCreateRequiredStaffCount} masseuse${selectedCreateRequiredStaffCount > 1 ? "s" : ""}.`,
      })
      return
    }

    const availableTimes = new Set(
      (createAvailability?.available_slots || []).map((slot) =>
        formatInTimeZone(slot.start, "Europe/Paris", "HH:mm")
      )
    )

    if (availableTimes.size > 0 && !availableTimes.has(createForm.startTime)) {
      toast.error("Créneau indisponible", {
        description: "Choisissez une heure dans les disponibilités proposées.",
      })
      return
    }

    const startDateTime = fromZonedTime(`${createForm.date} ${createForm.startTime}:00`, "Europe/Paris")

    createAppointment.mutate({
      salon_id: salonId,
      service_id: createForm.service_id,
      staff_ids: createForm.staff_ids,
      staff_id: createForm.staff_ids[0],
      start_time: startDateTime.toISOString(),
      client_data: {
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        phone: createForm.phone,
        email: createForm.email || undefined
      },
      client_notes: createForm.notes,
      status: "confirmed"
    }, {
      onSuccess: () => {
        setIsCreateOpen(false)
        setCreateForm({
          service_id: "",
          staff_ids: [],
          date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          startTime: "09:00",
          first_name: "",
          last_name: "",
          phone: "",
          email: "",
          notes: ""
        })
        setCreateClientSearchTerm("")
        setDebouncedCreateClientSearchTerm("")
        refetchAppointments()
      }
    })
  }

  const handleBlockSlot = () => {
    const defaultTime = getDefaultStartTimeForDate(selectedOpeningHours, date || new Date())
    setIsBlockingOpen(true)
    setBlockingForm((current) => ({
      ...current,
      startTime: defaultTime,
      endTime: selectedDayHours?.close || current.endTime,
    }))
  }

  const handleOpenCreate = () => {
    const defaultTime = getDefaultStartTimeForDate(selectedOpeningHours, date || new Date())
    setIsCreateOpen(true)
    setCreateForm((current) => ({
      ...current,
      date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: defaultTime,
    }))
  }

  const toggleStaffSelection = (staffId: string, formType: 'blocking' | 'create') => {
    if (formType === 'blocking') {
      const current = blockingForm.staff_ids
      if (current.includes(staffId)) {
        setBlockingForm({...blockingForm, staff_ids: current.filter(id => id !== staffId)})
      } else {
        setBlockingForm({...blockingForm, staff_ids: [...current, staffId]})
      }
    } else {
      const current = createForm.staff_ids
      if (current.includes(staffId)) {
        setCreateForm({...createForm, staff_ids: current.filter(id => id !== staffId)})
      } else {
        if (current.length >= selectedCreateRequiredStaffCount) {
          toast.error("Nombre de masseuses atteint", {
            description: `Cette prestation nécessite ${selectedCreateRequiredStaffCount} masseuse${selectedCreateRequiredStaffCount > 1 ? "s" : ""}.`,
          })
          return
        }
        setCreateForm({...createForm, staff_ids: [...current, staffId]})
      }
    }
  }

  const [blockingForm, setBlockingForm] = useState({
    staff_ids: [] as string[],
    startTime: "09:00",
    endTime: "10:00",
    notes: ""
  })

  const [createForm, setCreateForm] = useState({
    service_id: "",
    staff_ids: [] as string[],
    date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: ""
  })
  const [createClientSearchTerm, setCreateClientSearchTerm] = useState("")
  const [debouncedCreateClientSearchTerm, setDebouncedCreateClientSearchTerm] = useState("")
  const { data: createClientSuggestions, isFetching: isFetchingCreateClientSuggestions } = useClientSearch(
    debouncedCreateClientSearchTerm,
    8
  )
  const selectedCreateService = services?.find((service) => service.id === createForm.service_id)
  const selectedCreateRequiredStaffCount = selectedCreateService?.required_staff_count || 1
  const hasExplicitCreateServiceAssignments = Boolean(
    selectedCreateService &&
      bookableStaff.some((member) => (member.allowed_service_ids || []).includes(selectedCreateService.id))
  )
  const availableCreateStaff = bookableStaff.filter((member) => {
    if (!selectedCreateService || !hasExplicitCreateServiceAssignments) return true
    return (member.allowed_service_ids || []).includes(selectedCreateService.id)
  })
  const createAvailabilityStaffSelection =
    createForm.staff_ids.length >= selectedCreateRequiredStaffCount
      ? createForm.staff_ids
      : undefined
  const {
    data: createAvailability,
    isFetching: isFetchingCreateAvailability,
    isError: createAvailabilityHasError,
  } = useAvailability(
    createAvailabilityStaffSelection,
    createForm.date || undefined,
    createForm.service_id || undefined,
    salonId
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedCreateClientSearchTerm(createClientSearchTerm.trim())
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [createClientSearchTerm])

  // Handle empty slot click for quick create
  const handleEmptySlotClick = (data: { hour: number; minute: number; date: Date; staffId?: string }) => {
    setQuickCreateData(data)
    setIsQuickCreateOpen(true)
  }

  const handleCreateClientFieldChange = (field: "phone" | "first_name" | "last_name", value: string) => {
    setCreateForm((current) => ({
      ...current,
      [field]: value,
    }))
    setCreateClientSearchTerm(value)
  }

  const handleSelectCreateClientSuggestion = (client: Client) => {
    setCreateForm((current) => ({
      ...current,
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      phone: client.phone || "",
      email: client.email || "",
    }))
    setCreateClientSearchTerm("")
    setDebouncedCreateClientSearchTerm("")
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const appointment = active.data.current?.appointment
    if (appointment) {
      setActiveAppointment(appointment)
    }
  }

  const moveAppointment = async (move: { appointment: any; start: Date; end: Date }) => {
    setIsMovingAppointment(true)

    try {
      const response = await fetch(`/api/appointments/${move.appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: move.start.toISOString(),
          end_time: move.end.toISOString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Erreur lors du déplacement")
      }

      toast.success("Rendez-vous déplacé", {
        description: `Nouveau créneau: ${format(move.start, "HH:mm")} - ${format(move.end, "HH:mm")}`,
        icon: <Icon icon="solar:calendar-bold" className="w-5 h-5 text-green-500" />,
      })

      refetchAppointments()
    } catch (error: any) {
      toast.error("Impossible de déplacer le rendez-vous", {
        description: error.message || "Le créneau est peut-être déjà occupé",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    } finally {
      setIsMovingAppointment(false)
      setPendingMove(null)
    }
  }

  // Handle drag end - update appointment time and/or staff
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveAppointment(null)

    if (!over) return

    const appointment = active.data.current?.appointment
    const dropData = over.data.current as { hour: number; minute?: number; date: Date; staffId?: string }

    if (!appointment || !dropData) return

    // Calculate new start time
    const newDate = dropData.date
    const newHour = dropData.hour
    const newMinute = dropData.minute || 0

    // Create new start time
    const newStartTime = new Date(newDate)
    newStartTime.setHours(newHour, newMinute, 0, 0)

    // Calculate duration to determine new end time
    const durationMinutes = getAppointmentDurationMinutes(appointment)
    const newEndTime = addMinutes(newStartTime, durationMinutes)
    const assignedStaffIds = getAppointmentStaffIds(appointment)
    const primaryStaffId = assignedStaffIds[0] || appointment.staff_id || appointment.staff?.id
    const isMultiStaffMove = assignedStaffIds.length > 1
    const targetStaffId = dropData.staffId || appointment.staff_id || appointment.staff?.id
    const targetStaffIds = isMultiStaffMove
      ? assignedStaffIds
      : targetStaffId
        ? [targetStaffId]
        : assignedStaffIds

    // Check if anything actually changed
    const oldStart = new Date(appointment.start_time)
    const staffChanged = Boolean(dropData.staffId && (
      isMultiStaffMove ? !assignedStaffIds.includes(dropData.staffId) : dropData.staffId !== primaryStaffId
    ))
    const timeChanged = oldStart.getHours() !== newHour || oldStart.getMinutes() !== newMinute

    if (!staffChanged && !timeChanged) {
      return
    }

    if (isMultiStaffMove && staffChanged) {
      toast.error("Déplacement multi-masseuses bloqué", {
        description: "Un rendez-vous à plusieurs masseuses se déplace seulement en heure. Pour changer l'équipe, ouvrez les détails du rendez-vous.",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    const overlap = targetStaffIds.find((staffId) =>
      findOverlappingAppointment({
        appointments: appointments || [],
        staffId,
        start: newStartTime,
        end: newEndTime,
        ignoreAppointmentId: appointment.id,
      })
    )

    if (overlap) {
      toast.error("Créneau indisponible", {
        description: "Ce déplacement chevauche un autre rendez-vous pour au moins une masseuse concernée.",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    if (isMultiStaffMove) {
      setPendingMove({
        appointment,
        start: newStartTime,
        end: newEndTime,
        staffIds: assignedStaffIds,
      })
      return
    }

    try {
      const updateData: any = {
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
      }

      // If staff changed, update staff_id
      if (dropData.staffId && dropData.staffId !== primaryStaffId) {
        updateData.staff_id = dropData.staffId
        updateData.staff_ids = [dropData.staffId]
      }

      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Erreur lors du déplacement")
      }

      const staffMember = dropData.staffId ? bookableStaff.find(s => s.id === dropData.staffId) : null
      toast.success("Rendez-vous déplacé", {
        description: staffChanged
          ? `Nouveau créneau: ${format(newStartTime, "HH:mm")} avec ${staffMember ? getStaffDisplayName(staffMember) : "la masseuse"}`
          : `Nouveau créneau: ${format(newStartTime, "HH:mm")} - ${format(newEndTime, "HH:mm")}`,
        icon: <Icon icon="solar:calendar-bold" className="w-5 h-5 text-green-500" />,
      })

      refetchAppointments()
    } catch (error: any) {
      toast.error("Impossible de déplacer le rendez-vous", {
        description: error.message || "Le créneau est peut-être déjà occupé",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  const isInvalidSlotForActive = (slotDate: Date, slotStaffId: string, hour: number, minute: number) => {
    if (!activeAppointment) return false

    const targetStart = new Date(slotDate)
    targetStart.setHours(hour, minute, 0, 0)
    const targetEnd = addMinutes(targetStart, getAppointmentDurationMinutes(activeAppointment))

    const activeStaffIds = getAppointmentStaffIds(activeAppointment)
    const targetStaffIds = activeStaffIds.length > 1 ? activeStaffIds : [slotStaffId]

    return targetStaffIds.some((staffId) =>
      Boolean(findOverlappingAppointment({
        appointments: appointments || [],
        staffId,
        start: targetStart,
        end: targetEnd,
        ignoreAppointmentId: activeAppointment.id,
      }))
    )
  }

  // Visualizer Component
  const AvailabilityVisualizer = ({ staffIds, appointments }: { staffIds: string[], appointments: any[] }) => {
    if (!staffIds || staffIds.length === 0) return null;

    const openMinutes = selectedDayHours ? timeToMinutes(selectedDayHours.open) : null
    const closeMinutes = selectedDayHours ? timeToMinutes(selectedDayHours.close) : null
    const startMinutes = openMinutes ?? 9 * 60
    const endMinutes = closeMinutes ?? 19 * 60
    const totalMinutes = Math.max(15, endMinutes - startMinutes)

    // Collect all busy ranges for selected staff
    const busyRanges = appointments
      .filter(apt =>
        (staffIds.includes(apt.staff_id) || apt.assignments?.some((a: any) => staffIds.includes(a.staff?.id))) &&
        ['confirmed', 'pending', 'blocked', 'in_progress'].includes(apt.status)
      )
      .map(apt => {
        const start = new Date(apt.start_time);
        const end = new Date(apt.end_time);
        return {
          start: Math.max(0, (start.getHours() * 60 + start.getMinutes()) - startMinutes),
          end: Math.min(totalMinutes, (end.getHours() * 60 + end.getMinutes()) - startMinutes)
        };
      })
      .filter(range => range.end > range.start);

    return (
      <div className="mt-4 pt-4 border-t">
        <Label className="mb-2 block">
          Disponibilité commune ({minutesToTimeLabel(startMinutes)} - {minutesToTimeLabel(endMinutes)})
        </Label>
        <div className="h-8 bg-green-100 rounded-md relative overflow-hidden border">
          {busyRanges.map((range, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 bg-red-400/80 border-l border-r border-red-500"
              style={{
                left: `${(range.start / totalMinutes) * 100}%`,
                width: `${((range.end - range.start) / totalMinutes) * 100}%`
              }}
              title="Occupé"
            />
          ))}
          {/* Hour markers */}
          {Array.from({ length: Math.floor(totalMinutes / 60) + 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-gray-300 text-[10px] text-gray-500 pl-1 select-none pointer-events-none"
              style={{ left: `${((i * 60) / totalMinutes) * 100}%` }}
            >
              {Math.floor((startMinutes + i * 60) / 60)}h
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border rounded"></div> Disponible</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400/80 border rounded"></div> Occupé (au moins un membre)</div>
        </div>
      </div>
    )
  }

  const CreateAvailabilityPanel = ({
    requiredStaffCount,
    selectedStaffCount,
    selectedTime,
    availability,
    isFetching,
    hasError,
    onSelectTime,
  }: {
    requiredStaffCount: number
    selectedStaffCount: number
    selectedTime: string
    availability?: { available_slots?: Array<{ start: string; end: string; available_staff?: string[] }>; salon_hours?: { open: string; close: string } }
    isFetching: boolean
    hasError: boolean
    onSelectTime: (time: string) => void
  }) => {
    if (!createForm.service_id || !createForm.date) {
      return null
    }

    const slots = availability?.available_slots || []
    const slotTimes = slots.map((slot) => ({
      time: formatInTimeZone(slot.start, "Europe/Paris", "HH:mm"),
      availableStaffCount: slot.available_staff?.length || 0,
    }))
    const isSpecificSelectionComplete = selectedStaffCount === requiredStaffCount
    const availabilityModeLabel = isSpecificSelectionComplete
      ? `Disponibilités communes pour les ${requiredStaffCount} masseuse${requiredStaffCount > 1 ? "s" : ""} sélectionnée${requiredStaffCount > 1 ? "s" : ""}`
      : `Créneaux avec au moins ${requiredStaffCount} masseuse${requiredStaffCount > 1 ? "s" : ""} disponible${requiredStaffCount > 1 ? "s" : ""}`

    return (
      <div className="mt-4 space-y-3 border-t pt-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <Label>{availabilityModeLabel}</Label>
          <Badge variant={isSpecificSelectionComplete ? "default" : "outline"}>
            {selectedStaffCount}/{requiredStaffCount} sélectionné{selectedStaffCount > 1 ? "s" : ""}
          </Badge>
        </div>

        {!isSpecificSelectionComplete ? (
          <p className="text-xs text-muted-foreground">
            Sélectionnez {requiredStaffCount} masseuse{requiredStaffCount > 1 ? "s" : ""} pour vérifier leur disponibilité commune exacte.
          </p>
        ) : null}

        {isFetching ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Chargement des disponibilités...
          </div>
        ) : hasError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Impossible de charger les disponibilités pour cette date.
          </div>
        ) : slotTimes.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Aucun créneau disponible pour cette sélection. Changez la date, l'heure ou les masseuses.
          </div>
        ) : (
          <div className="rounded-lg border bg-green-50 p-3">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slotTimes.slice(0, 25).map((slot) => (
                <Button
                  key={slot.time}
                  type="button"
                  variant={selectedTime === slot.time ? "default" : "outline"}
                  className="h-10 bg-white text-sm font-semibold data-[selected=true]:bg-primary"
                  data-selected={selectedTime === slot.time}
                  onClick={() => onSelectTime(slot.time)}
                >
                  {slot.time}
                </Button>
              ))}
            </div>
            {slotTimes.length > 25 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {slotTimes.length - 25} autres créneaux disponibles plus tard.
              </p>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-muted/20">
        <AdminHeader
          title={`Tableau de bord - ${salon?.name || "Chargement..."}`}
          description="Gestion opérationnelle du salon"
        />

        <div className="container mx-auto space-y-5 p-4 md:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-2 rounded-lg border-l-4 border-l-sky-500 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Rendez-vous</span>
                <CalendarIcon className="h-4 w-4 text-sky-700" />
              </div>
              <div className="text-3xl font-bold">{dayAppointments.length}</div>
              <p className="text-xs text-muted-foreground">
                {selectedDayHours ? `${selectedDayHours.open} - ${selectedDayHours.close}` : "Salon fermé"}
              </p>
            </Card>
            <Card className="gap-2 rounded-lg border-l-4 border-l-violet-500 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">En cours</span>
                <Clock className="h-4 w-4 text-violet-700" />
              </div>
              <div className="text-3xl font-bold">{inProgressAppointments.length}</div>
              <p className="truncate text-xs text-muted-foreground">
                {nextAppointment ? `Prochain: ${formatInTimeZone(nextAppointment.start_time, "Europe/Paris", "HH:mm")}` : "Aucun prochain rendez-vous"}
              </p>
            </Card>
            <Card className="gap-2 rounded-lg border-l-4 border-l-emerald-500 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Terminés</span>
                <CheckCircle className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="text-3xl font-bold">{completedAppointments.length}</div>
              <p className="text-xs text-muted-foreground">{confirmedAppointments.length} à traiter</p>
            </Card>
            <Card className="gap-2 rounded-lg border-l-4 border-l-stone-500 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Bloqués</span>
                <Ban className="h-4 w-4 text-stone-700" />
              </div>
              <div className="text-3xl font-bold">{blockedAppointments.length}</div>
              <p className="text-xs text-muted-foreground">Créneaux indisponibles</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            {/* Left Sidebar - Calendar & Quick Actions */}
            <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <Card className="gap-4 rounded-lg p-4 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold">Date de travail</h2>
                  <p className="text-sm text-muted-foreground">Changer de jour recharge le planning.</p>
                </div>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="w-full rounded-md border shadow-sm"
                />
              </Card>

              <Card className="gap-3 rounded-lg p-4 shadow-sm">
                <div>
                  <h3 className="text-lg font-semibold">Actions rapides</h3>
                  <p className="text-sm text-muted-foreground">Créer, bloquer, puis ajuster au planning.</p>
                </div>
                <Button className="h-11 w-full justify-start cursor-pointer" variant="default" onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un rendez-vous
                </Button>
                <Button className="h-11 w-full justify-start cursor-pointer" variant="outline" onClick={handleBlockSlot}>
                  <Ban className="mr-2 h-4 w-4" />
                  Bloquer un créneau
                </Button>
              </Card>
            </div>

            {/* Main Content - Schedule & Appointments */}
            <div className="min-w-0 space-y-4">
              <Card className="rounded-lg p-4 shadow-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Planning du jour</p>
                    <h2 className="mt-1 text-2xl font-bold capitalize">
                      {date ? format(date, "EEEE d MMMM yyyy", { locale: fr }) : "Sélectionnez une date"}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="px-3 py-1">
                      {dayAppointments.length} rendez-vous
                    </Badge>
                    <Badge variant="secondary" className="px-3 py-1">
                      {selectedDayHours ? `${selectedDayHours.open} - ${selectedDayHours.close}` : "Salon fermé"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={handleBlockSlot} className="cursor-pointer">
                      <Ban className="mr-2 h-4 w-4" />
                      Bloquer
                    </Button>
                    <Button size="sm" onClick={handleOpenCreate} className="cursor-pointer">
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Colonnes = masseuses. Glissez un rendez-vous vers une autre heure ou une autre masseuse.
                      Les rendez-vous à plusieurs masseuses gardent toute l'équipe ensemble.
                    </p>
                  </div>
                </div>
              </Card>

              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="timeline">Planning</TabsTrigger>
                  <TabsTrigger value="list">Liste</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-4">
                  <Card className="min-h-[600px] rounded-lg border-border/80 shadow-sm">
                    <div className="overflow-x-auto p-2 sm:p-4">
                    <div style={{ minWidth: scheduleMinWidth }}>
                      {/* Header: Staff names */}
                      <div className="sticky top-0 z-20 mb-3 flex border-b border-border bg-card/95 pb-2 backdrop-blur">
                        <div className="shrink-0" style={{ width: TIME_COLUMN_WIDTH }}></div>
                        {bookableStaff.map(s => (
                          <div key={s.id} className="min-w-[152px] flex-1 border-l border-border px-2 text-center sm:min-w-[190px]">
                            <div className="truncate text-sm font-semibold sm:text-base">{getStaffDisplayName(s)}</div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Masseuse</div>
                          </div>
                        ))}
                      </div>

                      {/* Time slots */}
                      <div className="space-y-1">
                        {bookableStaff.length === 0 ? (
                          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                            {isStaffLoading || isAllStaffLoading ? "Chargement des masseuses du salon..." : "Aucune masseuse active pour ce salon."}
                          </div>
                        ) : scheduleHours.length === 0 ? (
                          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                            Salon fermé ce jour. Modifiez les horaires du salon pour ouvrir des créneaux.
                          </div>
                        ) : scheduleHours.map((hour) => {
                          return (
                            <div key={hour} className="relative flex border-t border-border" style={{ height: SCHEDULE_HOUR_HEIGHT }}>
                              <div className="shrink-0 bg-card pr-3 pt-1 text-right text-sm font-medium text-muted-foreground" style={{ width: TIME_COLUMN_WIDTH }}>
                                {hour.toString().padStart(2, "0")}:00
                              </div>
                              {bookableStaff.map(s => {
                                // Find appointments for this staff in this hour
                                const staffApts = appointments?.filter((apt: any) => {
                                  const aptHour = parseInt(formatInTimeZone(apt.start_time, "Europe/Paris", "H"), 10)
                                  return getAppointmentStaffIds(apt).includes(s.id) && aptHour === hour
                                })

                                const slotId = `slot-dashboard-${s.id}-${hour}`

                                return (
                                  <div key={`${s.id}-${hour}`} className="relative min-w-[152px] flex-1 border-l border-border bg-background/80 sm:min-w-[190px]">
                                    <div className="absolute inset-0 grid grid-rows-4">
                                      {[0, 15, 30, 45].map((minute, idx) => (
                                        <DroppableSlot
                                          key={`${slotId}-${minute}`}
                                          id={`${slotId}-${minute}`}
                                          hour={hour}
                                          minute={minute}
                                          staffId={s.id}
                                          date={date || new Date()}
                                          onEmptyClick={(data) => handleEmptySlotClick({ ...data, date: date || new Date() })}
                                          isInvalidDrop={isInvalidSlotForActive(date || new Date(), s.id, hour, minute)}
                                          isDragActive={Boolean(activeAppointment)}
                                          className={`${idx < 3 ? "border-b border-dashed border-border/50" : ""} min-h-[19px]`}
                                        >
                                          <div />
                                        </DroppableSlot>
                                      ))}
                                    </div>

                                    {staffApts?.map((apt: any) => {
                                      const startMinute = parseInt(formatInTimeZone(apt.start_time, "Europe/Paris", "m"), 10)
                                      const startHour = parseInt(formatInTimeZone(apt.start_time, "Europe/Paris", "H"), 10)
                                      const topOffset = startHour === hour ? (startMinute / 60) * SCHEDULE_HOUR_HEIGHT : 0
                                      const heightPx = Math.max((getAppointmentDurationMinutes(apt) / 60) * SCHEDULE_HOUR_HEIGHT, 20)
                                      const isDraggable = apt.status !== 'blocked' && apt.status !== 'completed' && apt.status !== 'cancelled'
                                      const appointmentStaffIds = getAppointmentStaffIds(apt)
                                      const isMultiStaffAppointment = appointmentStaffIds.length > 1

                                      return (
                                        <DraggableAppointment
                                          key={apt.id}
                                          id={apt.id}
                                          appointment={apt}
                                          disabled={!isDraggable}
                                          style={{
                                            position: "absolute",
                                            left: "4px",
                                            right: "4px",
                                            top: `${topOffset}px`,
                                            height: `${heightPx}px`,
                                          }}
                                          className={`overflow-hidden rounded-md border-2 p-1 text-xs shadow-sm transition-shadow hover:shadow-md ${getDashboardStatusClass(apt.status)}`}
                                        >
                                          <div
                                            className="w-full h-full"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (apt.status !== 'blocked') {
                                                handleValidate(apt)
                                              }
                                            }}
                                          >
                                            {isDraggable && (
                                              <GripVertical className="absolute right-0.5 top-0.5 w-3 h-3 text-muted-foreground/50" />
                                            )}
                                            {apt.status === 'blocked' ? (
                                              <div className="font-semibold text-[10px]">BLOQUÉ</div>
                                            ) : (
                                              <>
                                                <div className="flex items-center gap-1 font-semibold text-[10px]">
                                                  <span>{formatInTimeZone(apt.start_time, "Europe/Paris", "HH:mm")}</span>
                                                  {isMultiStaffAppointment ? (
                                                    <span className="rounded bg-background/80 px-1 text-[9px]">x{appointmentStaffIds.length}</span>
                                                  ) : null}
                                                </div>
                                                <div className="truncate text-[9px] font-medium">{apt.client?.first_name} {apt.client?.last_name?.[0]}.</div>
                                                {heightPx >= 30 && (
                                                  <div className="truncate text-[8px]">{apt.service?.name}</div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </DraggableAppointment>
                                      )
                                    })}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="list" className="mt-4">
                  <div className="space-y-3">
                    {dayAppointments.map((apt: any) => (
                      <Card key={apt.id} className="rounded-lg p-4 shadow-sm transition-colors hover:bg-muted/40">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 gap-4">
                            <div className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <span className="text-lg font-bold tabular-nums">{formatInTimeZone(apt.start_time, "Europe/Paris", "HH:mm")}</span>
                              <span className="text-[10px] text-primary/70">{formatInTimeZone(apt.end_time, "Europe/Paris", "HH:mm")}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">
                                  {apt.client?.first_name || "Client"} {apt.client?.last_name || ""}
                                </p>
                                <Badge className={`border ${getDashboardStatusClass(apt.status)}`}>
                                  {getDashboardStatusLabel(apt.status)}
                                </Badge>
                              </div>
                              <p className="mt-1 truncate text-sm text-muted-foreground">
                                {apt.service?.name || "Service"}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {getAppointmentStaffLabel(apt)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:justify-end">
                            {apt.status !== "blocked" && apt.payment_status !== "paid" && (
                              <Button size="sm" onClick={() => handleValidate(apt)} className="cursor-pointer">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Présent / payer
                              </Button>
                            )}
                            {apt.status !== "blocked" && (
                              <Button size="sm" variant="outline" onClick={() => { setSelectedSlot(apt); setIsDetailsOpen(true) }} className="cursor-pointer">
                                Détails
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}

                    {dayAppointments.length === 0 && (
                      <Card className="rounded-lg border-dashed p-8 text-center shadow-sm">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="font-medium">Aucun rendez-vous pour cette date</p>
                        <p className="mt-1 text-sm text-muted-foreground">Ajoutez un rendez-vous ou bloquez un créneau.</p>
                        <Button onClick={handleOpenCreate} className="cursor-pointer">
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter un rendez-vous
                        </Button>
                      </Card>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Validation Dialog */}
        <Dialog open={isValidationOpen} onOpenChange={setIsValidationOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Valider la venue du client</DialogTitle>
              <DialogDescription>
                Confirmer la présence et procéder au paiement
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {paymentLines.map((line, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="space-y-2 flex-1">
                    <Label>Mode de paiement {paymentLines.length > 1 ? index + 1 : ''}</Label>
                    <Select value={line.method} onValueChange={(val) => updatePaymentLine(index, 'method', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un moyen de paiement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">Carte Bancaire</SelectItem>
                        <SelectItem value="cash">Espèces</SelectItem>
                        <SelectItem value="treatwell">Treatwell</SelectItem>
                        <SelectItem value="gift_card">Carte Cadeau</SelectItem>
                        <SelectItem value="loyalty">Points Fidélité</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 w-32">
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      value={line.amount}
                      onChange={(e) => updatePaymentLine(index, 'amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {paymentLines.length > 1 && (
                    <Button variant="ghost" size="icon" className="mb-0.5 text-destructive cursor-pointer" onClick={() => removePaymentLine(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={addPaymentLine} className="w-full cursor-pointer">
                <Plus className="w-4 h-4 mr-2" /> Ajouter un autre moyen de paiement
              </Button>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold">Total payé:</span>
                <span className={paymentLines.reduce((sum, l) => sum + l.amount, 0) === (selectedSlot?.service?.price_cents / 100) ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                  {paymentLines.reduce((sum, l) => sum + l.amount, 0).toFixed(2)}€ / {(selectedSlot?.service?.price_cents / 100)?.toFixed(2)}€
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsValidationOpen(false)} className="cursor-pointer">Annuler</Button>
              <Button onClick={handleConfirmValidation} className="cursor-pointer">Confirmer et payer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Booking Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Détails du rendez-vous</DialogTitle>
              <DialogDescription>
                Informations complètes sur ce rendez-vous
              </DialogDescription>
            </DialogHeader>

            {selectedSlot && (
              <div className="space-y-4 py-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <Badge className={`border px-3 py-1 text-sm font-bold ${getDashboardStatusClass(selectedSlot.status)}`}>
                    {getDashboardStatusLabel(selectedSlot.status)}
                  </Badge>
                  {selectedSlot.payment_status && (
                    <Badge variant={selectedSlot.payment_status === "paid" ? "default" : "outline"} className="text-sm px-3 py-1">
                      {selectedSlot.payment_status === "paid" ? "Payé" : "Paiement en attente"}
                    </Badge>
                  )}
                </div>

                {/* Client Information */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Client
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{selectedSlot.client?.first_name} {selectedSlot.client?.last_name}</p>
                    {selectedSlot.client?.phone && <p className="text-muted-foreground">📞 {selectedSlot.client.phone}</p>}
                    {selectedSlot.client?.email && <p className="text-muted-foreground">✉️ {selectedSlot.client.email}</p>}
                  </div>
                </div>

                {/* Service & Timing */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      Service
                    </h4>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{selectedSlot.service?.name}</p>
                      <p className="text-muted-foreground">
                        ⏱️ {selectedSlot.service?.duration_minutes} minutes
                      </p>
                      <p className="text-muted-foreground">
                        💶 {(selectedSlot.service?.price_cents / 100)?.toFixed(2)}€
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Horaires
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>{formatInTimeZone(selectedSlot.start_time, "Europe/Paris", "dd/MM/yyyy")}</p>
                      <p className="font-medium">
                        {formatInTimeZone(selectedSlot.start_time, "Europe/Paris", "HH:mm")} - {formatInTimeZone(selectedSlot.end_time, "Europe/Paris", "HH:mm")}
                      </p>
                      <p className="text-muted-foreground">
                        Durée: {Math.round((new Date(selectedSlot.end_time).getTime() - new Date(selectedSlot.start_time).getTime()) / (1000 * 60))} min
                      </p>
                    </div>
                  </div>
                </div>

                {/* Staff/Employees */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-semibold">Masseuse(s)</h4>
                  <div className="space-y-2">
                    {getAppointmentStaffIds(selectedSlot).map((staffId) => {
                      const assignedMember = dashboardStaff.find((member) => member.id === staffId) ||
                        selectedSlot.assignments?.find((assignment: any) => assignment.staff_id === staffId || assignment.staff?.id === staffId)?.staff ||
                        (selectedSlot.staff?.id === staffId ? selectedSlot.staff : null)
                      const assignedStaffIds = getAppointmentStaffIds(selectedSlot)

                      return (
                        <div key={staffId} className="flex flex-col gap-2 rounded-lg border bg-background p-2 sm:flex-row sm:items-center sm:justify-between">
                          <Badge variant="outline" className="w-fit px-3 py-1">
                            {assignedMember ? getStaffDisplayName(assignedMember) : "Masseuse"}
                          </Badge>
                          <Select
                            value={staffId}
                            onValueChange={(nextStaffId) => handleReplaceAppointmentStaff(selectedSlot, staffId, nextStaffId)}
                            disabled={Boolean(replacingStaffId)}
                          >
                            <SelectTrigger className="h-9 sm:w-[220px]">
                              <SelectValue placeholder="Remplacer" />
                            </SelectTrigger>
                            <SelectContent>
                              {bookableStaff
                                .filter((member) => member.id === staffId || !assignedStaffIds.includes(member.id))
                                .map((member) => {
                                  const available = member.id === staffId || isStaffAvailableForAppointment(selectedSlot, member.id)

                                  return (
                                    <SelectItem key={member.id} value={member.id} disabled={!available}>
                                      {getStaffDisplayName(member)}{available ? "" : " - indisponible"}
                                    </SelectItem>
                                  )
                                })}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}
                    {getAppointmentStaffIds(selectedSlot).length > 1 ? (
                      <p className="text-xs text-muted-foreground">
                        Vous pouvez remplacer une masseuse seulement si la nouvelle est libre sur tout le créneau.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Payment Information (if paid) */}
                {selectedSlot.payment_status === 'paid' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                    <h4 className="font-semibold text-green-800">Paiement</h4>
                    <div className="text-sm space-y-1">
                      <p className="flex justify-between">
                        <span>Montant:</span>
                        <span className="font-medium">{(selectedSlot.amount_paid_cents / 100)?.toFixed(2)}€</span>
                      </p>
                      {selectedSlot.payment_method && (
                        <p className="flex justify-between">
                          <span>Mode:</span>
                          <span className="font-medium">
                            {selectedSlot.payment_method === 'card' ? 'Carte Bancaire' :
                             selectedSlot.payment_method === 'cash' ? 'Espèces' :
                             selectedSlot.payment_method === 'check' ? 'Chèque' :
                             selectedSlot.payment_method === 'treatwell' ? 'Treatwell' :
                             selectedSlot.payment_method === 'gift_card' ? 'Carte Cadeau' :
                             selectedSlot.payment_method === 'loyalty' ? 'Points Fidélité' :
                             selectedSlot.payment_method === 'mixed' ? 'Paiement Mixte' :
                             selectedSlot.payment_method}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {(selectedSlot.notes || selectedSlot.client_notes) && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-semibold">Notes</h4>
                    <div className="text-sm space-y-2">
                      {selectedSlot.client_notes && (
                        <div>
                          <p className="font-medium text-muted-foreground">Client:</p>
                          <p>{selectedSlot.client_notes}</p>
                        </div>
                      )}
                      {selectedSlot.notes && (
                        <div>
                          <p className="font-medium text-muted-foreground">Interne:</p>
                          <p>{selectedSlot.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedSlot && selectedSlot.status !== "blocked" ? (
              <div className="grid gap-2 border-t pt-4 sm:grid-cols-2">
                {selectedSlot.payment_status !== "paid" && !["cancelled", "no_show"].includes(selectedSlot.status) ? (
                  <Button onClick={() => handleOpenPayment(selectedSlot)} className="cursor-pointer">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Présent / payer
                  </Button>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailsOpen(false)} className="cursor-pointer">Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Blocking Dialog */}
        <Dialog open={isBlockingOpen} onOpenChange={setIsBlockingOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bloquer un créneau</DialogTitle>
              <DialogDescription>
                Rendre un créneau indisponible pour une ou plusieurs masseuses
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Masseuses</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {blockingForm.staff_ids.map(id => {
                    const member = bookableStaff.find(s => s.id === id)
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 flex items-center p-2">
                        <span>{member?.first_name} {member?.last_name}</span>
                        <X className="w-3 h-3 cursor-pointer hover:text-destructive ml-1" onClick={() => toggleStaffSelection(id, 'blocking')} />
                      </Badge>
                    )
                  })}
                </div>
                <Select onValueChange={(val) => toggleStaffSelection(val, 'blocking')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ajouter une masseuse" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookableStaff.filter(s => !blockingForm.staff_ids.includes(s.id)).map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Heure de début</Label>
                  <Input
                    type="time"
                    value={blockingForm.startTime}
                    onChange={(e) => setBlockingForm({...blockingForm, startTime: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Heure de fin</Label>
                  <Input
                    type="time"
                    value={blockingForm.endTime}
                    onChange={(e) => setBlockingForm({...blockingForm, endTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note (optionnel)</Label>
                <Textarea
                  placeholder="Raison du blocage..."
                  value={blockingForm.notes}
                  onChange={(e) => setBlockingForm({...blockingForm, notes: e.target.value})}
                />
              </div>

              <AvailabilityVisualizer staffIds={blockingForm.staff_ids} appointments={appointments || []} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBlockingOpen(false)} className="cursor-pointer">Annuler</Button>
              <Button onClick={handleConfirmBlocking} variant="destructive" className="cursor-pointer">Bloquer le créneau</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Manual Appointment Dialog */}
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) {
              setCreateClientSearchTerm("")
              setDebouncedCreateClientSearchTerm("")
            }
          }}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter un rendez-vous</DialogTitle>
              <DialogDescription>
                Créer manuellement un rendez-vous pour un client
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={createForm.service_id} onValueChange={(val) => setCreateForm({...createForm, service_id: val, staff_ids: [], startTime: ""})}>
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
                <div className="flex items-center justify-between gap-3">
                  <Label>Masseuses</Label>
                  {createForm.service_id ? (
                    <Badge variant={createForm.staff_ids.length === selectedCreateRequiredStaffCount ? "default" : "outline"}>
                      {createForm.staff_ids.length}/{selectedCreateRequiredStaffCount} requis
                    </Badge>
                  ) : null}
                </div>
                {createForm.service_id ? (
                  <p className="text-xs text-muted-foreground">
                    Cette prestation nécessite exactement {selectedCreateRequiredStaffCount} masseuse{selectedCreateRequiredStaffCount > 1 ? "s" : ""}. Sélectionnez uniquement le nombre requis.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 mb-2">
                  {createForm.staff_ids.map(id => {
                    const member = bookableStaff.find(s => s.id === id)
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 flex items-center p-2">
                        <span>{member?.first_name} {member?.last_name}</span>
                        <X className="w-3 h-3 cursor-pointer hover:text-destructive ml-1" onClick={() => toggleStaffSelection(id, 'create')} />
                      </Badge>
                    )
                  })}
                </div>
                <Select
                  onValueChange={(val) => toggleStaffSelection(val, 'create')}
                  disabled={!createForm.service_id || createForm.staff_ids.length >= selectedCreateRequiredStaffCount}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !createForm.service_id
                        ? "Choisir une prestation d'abord"
                        : createForm.staff_ids.length >= selectedCreateRequiredStaffCount
                          ? "Nombre requis atteint"
                          : "Ajouter une masseuse"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCreateStaff.filter(s => !createForm.staff_ids.includes(s.id)).map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Heure de début</Label>
                  <Input
                    type="time"
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({...createForm, startTime: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={createForm.date}
                    onChange={(e) => setCreateForm({...createForm, date: e.target.value, startTime: ""})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input
                    value={createForm.first_name}
                    onChange={(e) => handleCreateClientFieldChange("first_name", e.target.value)}
                    placeholder="Prénom"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input
                    value={createForm.last_name}
                    onChange={(e) => handleCreateClientFieldChange("last_name", e.target.value)}
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input
                    value={createForm.phone}
                    onChange={(e) => handleCreateClientFieldChange("phone", e.target.value)}
                    placeholder="06..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                    placeholder="client@email.com"
                  />
                </div>
              </div>

              <ClientSuggestionList
                visible={debouncedCreateClientSearchTerm.length >= 2 || createClientSearchTerm.trim().length >= 2}
                clients={createClientSuggestions}
                isLoading={isFetchingCreateClientSuggestions}
                onSelect={handleSelectCreateClientSuggestion}
              />

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Notes sur le rendez-vous..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({...createForm, notes: e.target.value})}
                />
              </div>

              <CreateAvailabilityPanel
                requiredStaffCount={selectedCreateRequiredStaffCount}
                selectedStaffCount={createForm.staff_ids.length}
                selectedTime={createForm.startTime}
                availability={createAvailability}
                isFetching={isFetchingCreateAvailability}
                hasError={createAvailabilityHasError}
                onSelectTime={(time) => setCreateForm({...createForm, startTime: time})}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="cursor-pointer">Annuler</Button>
              <Button onClick={handleCreateAppointment} disabled={createAppointment.isPending} className="cursor-pointer">
                {createAppointment.isPending ? "Création..." : "Créer le rendez-vous"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Create Modal */}
        <QuickCreateModal
          isOpen={isQuickCreateOpen}
          onClose={() => {
            setIsQuickCreateOpen(false)
            setQuickCreateData(null)
          }}
          salonId={salonId}
          prefillData={quickCreateData || undefined}
          existingAppointments={appointments || []}
          openingHours={selectedOpeningHours}
          onSuccess={() => refetchAppointments()}
        />

        <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => !open && setPendingMove(null)}>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Déplacer tout le rendez-vous ?</DialogTitle>
              <DialogDescription>
                Ce rendez-vous mobilise {pendingMove?.staffIds.length || 0} masseuses. Le déplacement changera le créneau pour toute l'équipe assignée.
              </DialogDescription>
            </DialogHeader>
            {pendingMove ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-medium">
                  {pendingMove.appointment.client?.first_name || "Client"} {pendingMove.appointment.client?.last_name || ""}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {format(pendingMove.start, "dd/MM/yyyy HH:mm")} - {format(pendingMove.end, "HH:mm")}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Pour changer seulement une masseuse, annulez puis ouvrez les détails du rendez-vous.
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingMove(null)} disabled={isMovingAppointment}>
                Annuler
              </Button>
              <Button onClick={() => pendingMove && moveAppointment(pendingMove)} disabled={isMovingAppointment}>
                {isMovingAppointment ? "Déplacement..." : "Déplacer tout le rendez-vous"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>

      {/* Drag Overlay for visual feedback */}
      <DragOverlay>
        {activeAppointment ? (
          <div className={`text-xs p-2 rounded border shadow-lg bg-white/90 backdrop-blur ${
            activeAppointment.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border-blue-300' :
            activeAppointment.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' :
            'bg-gray-100 border-gray-300'
          }`}>
            <div className="font-medium">
              {activeAppointment.client?.first_name} {activeAppointment.client?.last_name?.[0]}.
            </div>
            <div className="truncate text-muted-foreground">
              {activeAppointment.service?.name}
            </div>
            <div className="text-[10px] font-medium">
              {formatInTimeZone(activeAppointment.start_time, "Europe/Paris", "HH:mm")}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
