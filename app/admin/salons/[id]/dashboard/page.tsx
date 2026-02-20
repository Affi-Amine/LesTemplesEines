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
import { toZonedTime, formatInTimeZone } from "date-fns-tz"
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
import { DndContext, PointerSensor, TouchSensor, useSensors, useSensor, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core"
import { DraggableAppointment, DroppableSlot, QuickCreateModal } from "@/components/calendar"

import { useRouter } from "next/navigation"

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
  const { data: salons } = useSalons()
  const { data: appointments, refetch: refetchAppointments } = useAppointments({
    salonId,
    startDate: date ? format(date, "yyyy-MM-dd") : undefined,
    endDate: date ? format(date, "yyyy-MM-dd") : undefined,
  })
  const { data: staff } = useStaff(salonId)
  const { data: services } = useServices(salonId)
  const createAppointment = useCreateAppointment()

  const salon = salons?.find(s => s.id === salonId)

  const [paymentLines, setPaymentLines] = useState<{method: string, amount: number}[]>([{ method: "card", amount: 0 }])

  const handleValidate = async (appointment: any) => {
    setSelectedSlot(appointment)

    // If appointment is already completed/paid, show details instead of payment panel
    if (appointment.status === 'completed' || appointment.payment_status === 'paid') {
      setIsDetailsOpen(true)
    } else {
      // Show payment panel for pending/confirmed appointments
      const price = appointment.service?.price_cents ? appointment.service.price_cents / 100 : 0
      setPaymentLines([{ method: "card", amount: price }])
      setIsValidationOpen(true)
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
          status: "completed",
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

      toast.success("Paiement validé et rendez-vous terminé !")
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
    if (!date || createForm.staff_ids.length === 0 || !createForm.startTime || !createForm.service_id || !createForm.first_name || !createForm.last_name || !createForm.phone) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    const startDateTime = new Date(date)
    const [startHour, startMinute] = createForm.startTime.split(':')
    startDateTime.setHours(parseInt(startHour), parseInt(startMinute))

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
          startTime: "09:00",
          first_name: "",
          last_name: "",
          phone: "",
          email: "",
          notes: ""
        })
        refetchAppointments()
      }
    })
  }

  const handleBlockSlot = () => {
    setIsBlockingOpen(true)
  }

  const handleOpenCreate = () => {
    setIsCreateOpen(true)
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
    startTime: "09:00",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: ""
  })

  // Handle empty slot click for quick create
  const handleEmptySlotClick = (data: { hour: number; minute: number; date: Date; staffId?: string }) => {
    setQuickCreateData(data)
    setIsQuickCreateOpen(true)
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const appointment = active.data.current?.appointment
    if (appointment) {
      setActiveAppointment(appointment)
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
    const start = new Date(appointment.start_time)
    const end = new Date(appointment.end_time)
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    const newEndTime = addMinutes(newStartTime, durationMinutes)

    // Check if anything actually changed
    const oldStart = new Date(appointment.start_time)
    const staffChanged = dropData.staffId && dropData.staffId !== appointment.staff_id
    const timeChanged = oldStart.getHours() !== newHour || oldStart.getMinutes() !== newMinute

    if (!staffChanged && !timeChanged) {
      return
    }

    try {
      const updateData: any = {
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
      }

      // If staff changed, update staff_id
      if (dropData.staffId && dropData.staffId !== appointment.staff_id) {
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

      const staffMember = dropData.staffId ? staff?.find(s => s.id === dropData.staffId) : null
      toast.success("Rendez-vous déplacé", {
        description: staffChanged
          ? `Nouveau créneau: ${format(newStartTime, "HH:mm")} avec ${staffMember?.first_name || "le prestataire"}`
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

  // Visualizer Component
  const AvailabilityVisualizer = ({ staffIds, appointments }: { staffIds: string[], appointments: any[] }) => {
    if (!staffIds || staffIds.length === 0) return null;

    // Define day start/end (e.g. 9h - 19h)
    const startHour = 9;
    const endHour = 19;
    const totalMinutes = (endHour - startHour) * 60;

    // Collect all busy ranges for selected staff
    const busyRanges = appointments
      .filter(apt =>
        (staffIds.includes(apt.staff_id) || apt.assignments?.some((a: any) => staffIds.includes(a.staff?.id))) &&
        ['confirmed', 'pending', 'blocked'].includes(apt.status)
      )
      .map(apt => {
        const start = new Date(apt.start_time);
        const end = new Date(apt.end_time);
        return {
          start: Math.max(0, (start.getHours() * 60 + start.getMinutes()) - (startHour * 60)),
          end: Math.min(totalMinutes, (end.getHours() * 60 + end.getMinutes()) - (startHour * 60))
        };
      })
      .filter(range => range.end > range.start);

    return (
      <div className="mt-4 pt-4 border-t">
        <Label className="mb-2 block">Disponibilité commune (09:00 - 19:00)</Label>
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
          {Array.from({ length: endHour - startHour + 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-gray-300 text-[10px] text-gray-500 pl-1 select-none pointer-events-none"
              style={{ left: `${(i / (endHour - startHour)) * 100}%` }}
            >
              {startHour + i}h
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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-background">
        <AdminHeader
          title={`Tableau de bord - ${salon?.name || "Chargement..."}`}
          description="Gestion opérationnelle du salon"
        />

        <div className="container mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Calendar & Quick Actions */}
            <div className="space-y-6">
              <Card className="p-4">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-md border shadow-sm w-full"
                />
              </Card>

              <Card className="p-4 space-y-4">
                <h3 className="font-semibold text-lg">Actions Rapides</h3>
                <Button className="w-full justify-start cursor-pointer" variant="outline" onClick={handleBlockSlot}>
                  <Ban className="mr-2 h-4 w-4" />
                  Bloquer un créneau
                </Button>
                <Button className="w-full justify-start cursor-pointer" variant="default" onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un rendez-vous
                </Button>
              </Card>
            </div>

            {/* Main Content - Schedule & Appointments */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">
                  {date ? format(date, "EEEE d MMMM yyyy", { locale: fr }) : "Sélectionnez une date"}
                </h2>
                <div className="flex gap-2">
                  <Badge variant="outline" className="px-3 py-1">
                    {appointments?.length || 0} rendez-vous
                  </Badge>
                </div>
              </div>

              {/* Drag-and-Drop Instructions */}
              <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
                <div className="p-3">
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    <GripVertical className="w-4 h-4" />
                    <span>
                      <strong>Glisser-déposer:</strong> Déplacez les rendez-vous entre les créneaux ou les prestataires. Cliquez sur un créneau vide pour créer un nouveau rendez-vous.
                    </span>
                  </div>
                </div>
              </Card>

              <Tabs defaultValue="timeline" className="w-full">
                <TabsList>
                  <TabsTrigger value="timeline">Vue Chronologique</TabsTrigger>
                  <TabsTrigger value="list">Liste</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-4">
                  <Card className="p-6 min-h-[600px] overflow-x-auto">
                    <div className="min-w-[800px]">
                      {/* Header: Staff names */}
                      <div className="flex border-b pb-4 mb-4">
                        <div className="w-20 shrink-0"></div>
                        {staff?.map(s => (
                          <div key={s.id} className="flex-1 text-center font-semibold border-l">
                            {s.first_name}
                          </div>
                        ))}
                      </div>

                      {/* Time slots */}
                      <div className="space-y-2">
                        {Array.from({ length: 11 }).map((_, i) => {
                          const hour = i + 9 // 9:00 to 19:00
                          return (
                            <div key={hour} className="flex h-[60px] border-t relative">
                              <div className="w-20 shrink-0 text-sm text-muted-foreground -mt-3 bg-background pr-2 text-right">
                                {hour}:00
                              </div>
                              {staff?.map(s => {
                                // Find appointments for this staff in this hour
                                const staffApts = appointments?.filter((apt: any) => {
                                  const aptHour = parseInt(formatInTimeZone(apt.start_time, "Europe/Paris", "H"), 10)
                                  const aptEndHour = parseInt(formatInTimeZone(apt.end_time, "Europe/Paris", "H"), 10)

                                  // Include if appointment starts in this hour OR spans into this hour
                                  return (apt.staff_id === s.id || apt.assignments?.some((a:any) => a.staff?.id === s.id)) &&
                                         ((aptHour === hour) || (aptHour < hour && aptEndHour > hour))
                                })

                                const slotId = `slot-dashboard-${s.id}-${hour}`

                                return (
                                  <DroppableSlot
                                    key={slotId}
                                    id={slotId}
                                    hour={hour}
                                    staffId={s.id}
                                    date={date || new Date()}
                                    onEmptyClick={(data) => handleEmptySlotClick({ ...data, date: date || new Date() })}
                                    className="flex-1 border-l relative overflow-visible"
                                  >
                                    {/* 15-minute grid lines */}
                                    <div className="absolute top-[15px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>
                                    <div className="absolute top-[30px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>
                                    <div className="absolute top-[45px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>

                                    {/* Appointments */}
                                    {staffApts?.map((apt: any) => {
                                      // Calculate position and height
                                      const startMinute = parseInt(formatInTimeZone(apt.start_time, "Europe/Paris", "m"), 10)
                                      const startHour = parseInt(formatInTimeZone(apt.start_time, "Europe/Paris", "H"), 10)
                                      const topOffset = startHour === hour ? startMinute : 0

                                      const start = new Date(apt.start_time)
                                      const end = new Date(apt.end_time)
                                      const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
                                      const heightPx = Math.max(durationMinutes, 15)

                                      const isDraggable = apt.status !== 'blocked' && apt.status !== 'completed' && apt.status !== 'cancelled'

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
                                          className={`text-xs p-1 rounded hover:shadow-md transition-shadow ${
                                            apt.status === 'blocked' ? 'bg-red-100 text-red-800 border border-red-300' :
                                            apt.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                            apt.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-300' :
                                            'bg-gray-100 border border-gray-300'
                                          }`}
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
                                                <div className="font-semibold text-[10px]">{formatInTimeZone(apt.start_time, "Europe/Paris", "HH:mm")}</div>
                                                <div className="truncate text-[9px]">{apt.client?.first_name} {apt.client?.last_name?.[0]}.</div>
                                                {heightPx >= 30 && (
                                                  <div className="truncate text-[8px]">{apt.service?.name}</div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </DraggableAppointment>
                                      )
                                    })}
                                  </DroppableSlot>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="list" className="mt-4">
                  <div className="space-y-4">
                    {appointments?.map((apt: any) => (
                      <Card key={apt.id} className="p-4 flex justify-between items-center hover:bg-muted/50 transition-colors">
                        <div className="flex gap-4 items-center">
                          <div className="bg-primary/10 p-3 rounded-full">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {format(new Date(apt.start_time), "HH:mm")} - {apt.client?.first_name} {apt.client?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {apt.service?.name} avec {apt.staff?.first_name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge variant={apt.status === "confirmed" ? "default" : "secondary"}>
                            {apt.status}
                          </Badge>
                          {apt.status === "confirmed" && (
                            <Button size="sm" onClick={() => handleValidate(apt)} className="cursor-pointer">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Valider
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}

                    {(!appointments || appointments.length === 0) && (
                      <div className="text-center py-12 text-muted-foreground">
                        Aucun rendez-vous pour cette date
                      </div>
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
              <Button onClick={handleConfirmValidation} className="cursor-pointer">Confirmer et Payer</Button>
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
                  <Badge variant={selectedSlot.status === "completed" ? "default" : "secondary"} className="text-sm px-3 py-1">
                    {selectedSlot.status === "completed" ? "✓ Terminé" :
                     selectedSlot.status === "confirmed" ? "Confirmé" :
                     selectedSlot.status === "pending" ? "En attente" :
                     selectedSlot.status}
                  </Badge>
                  {selectedSlot.payment_status && (
                    <Badge variant={selectedSlot.payment_status === "paid" ? "default" : "outline"} className="text-sm px-3 py-1">
                      {selectedSlot.payment_status === "paid" ? "💳 Payé" : "En attente de paiement"}
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
                  <h4 className="font-semibold">Prestataire(s)</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedSlot.staff && (
                      <Badge variant="outline" className="px-3 py-1">
                        {selectedSlot.staff.first_name} {selectedSlot.staff.last_name}
                      </Badge>
                    )}
                    {selectedSlot.assignments
                      ?.filter((assignment: any) => assignment.staff?.id !== selectedSlot.staff?.id)
                      .map((assignment: any) => (
                        <Badge key={assignment.staff?.id} variant="outline" className="px-3 py-1">
                          {assignment.staff?.first_name} {assignment.staff?.last_name}
                        </Badge>
                      ))}
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
                Rendre un créneau indisponible pour un ou plusieurs prestataires
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Prestataires</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {blockingForm.staff_ids.map(id => {
                    const member = staff?.find(s => s.id === id)
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
                    <SelectValue placeholder="Ajouter un prestataire" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff?.filter(s => !blockingForm.staff_ids.includes(s.id)).map((member) => (
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                <Select value={createForm.service_id} onValueChange={(val) => setCreateForm({...createForm, service_id: val})}>
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
                <Label>Prestataires</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {createForm.staff_ids.map(id => {
                    const member = staff?.find(s => s.id === id)
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 flex items-center p-2">
                        <span>{member?.first_name} {member?.last_name}</span>
                        <X className="w-3 h-3 cursor-pointer hover:text-destructive ml-1" onClick={() => toggleStaffSelection(id, 'create')} />
                      </Badge>
                    )
                  })}
                </div>
                <Select onValueChange={(val) => toggleStaffSelection(val, 'create')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ajouter un prestataire" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff?.filter(s => !createForm.staff_ids.includes(s.id)).map((member) => (
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
                  <div className="p-2 border rounded bg-muted text-sm">
                    {date ? format(date, "EEEE d MMMM yyyy", { locale: fr }) : "Aucune date sélectionnée"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input
                    value={createForm.first_name}
                    onChange={(e) => setCreateForm({...createForm, first_name: e.target.value})}
                    placeholder="Prénom"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input
                    value={createForm.last_name}
                    onChange={(e) => setCreateForm({...createForm, last_name: e.target.value})}
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({...createForm, phone: e.target.value})}
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

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Notes sur le rendez-vous..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({...createForm, notes: e.target.value})}
                />
              </div>

              <AvailabilityVisualizer staffIds={createForm.staff_ids} appointments={appointments || []} />
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
          onSuccess={() => refetchAppointments()}
        />
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
