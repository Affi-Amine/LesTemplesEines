"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GripVertical } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay, eachHourOfInterval, addMinutes } from "date-fns"
import { fr } from "date-fns/locale"
import { formatInTimeZone, toZonedTime } from "date-fns-tz"
import { getStatusColor, getStatusLabel, getStatusDescription } from "@/lib/utils"
import { toast } from "sonner"
import { Icon } from "@iconify/react"

import { BookingDetailsModal } from "@/components/booking-details-modal"
import { DndContext, PointerSensor, TouchSensor, useSensors, useSensor, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core"
import { DraggableAppointment, DroppableSlot, QuickCreateModal } from "@/components/calendar"

interface Salon {
  id: string
  name: string
  city: string
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: string
  salon_id: string
  staff_id?: string
  client: {
    first_name: string
    last_name: string
  }
  staff: {
    id: string
    first_name: string
    last_name: string
  }
  service: {
    name: string
    duration_minutes: number
  }
  salon: {
    name: string
  }
}

// Week View Component with Drag-and-Drop
function WeekView({
  currentDate,
  appointments,
  onAppointmentClick,
  onEmptySlotClick,
}: {
  currentDate: Date
  appointments: Appointment[]
  onAppointmentClick: (appointment: Appointment) => void
  onEmptySlotClick: (data: { hour: number; minute: number; date: Date }) => void
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = eachHourOfInterval({ start: startOfDay(new Date()), end: endOfDay(new Date()) })

  const getAppointmentsForDayAndHour = (day: Date, hour: Date) => {
    return appointments.filter(appointment => {
      const aptDateStr = formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd")
      const dayDateStr = format(day, "yyyy-MM-dd")

      if (aptDateStr !== dayDateStr) return false

      const aptHour = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"), 10)
      const aptEndHour = parseInt(formatInTimeZone(appointment.end_time, "Europe/Paris", "H"), 10)
      const targetHour = hour.getHours()

      return (aptHour === targetHour) || (aptHour < targetHour && aptEndHour > targetHour)
    })
  }

  const calculateDurationMinutes = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  }

  const getAppointmentPosition = (appointment: Appointment, hourStart: number) => {
    const startMinute = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "m"), 10)
    const startHour = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"), 10)

    const topOffset = startHour === hourStart ? startMinute : 0
    const durationMinutes = calculateDurationMinutes(appointment.start_time, appointment.end_time)

    return {
      top: topOffset,
      height: Math.max(durationMinutes, 15),
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header with days */}
        <div className="grid grid-cols-8 gap-1 mb-4">
          <div className="p-2"></div>
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="p-2 text-center font-medium">
              <div className="text-sm text-muted-foreground">
                {format(day, "EEE", { locale: fr })}
              </div>
              <div className={`text-lg ${isSameDay(day, new Date()) ? "text-primary font-bold" : ""}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="space-y-1">
          {hours.filter(hour => hour.getHours() >= 8 && hour.getHours() <= 20).map((hour) => (
            <div key={hour.toISOString()} className="grid grid-cols-8 gap-1">
              <div className="p-2 text-sm text-muted-foreground text-right">
                {format(hour, "HH:mm")}
              </div>
              {weekDays.map((day) => {
                const hourAppointments = getAppointmentsForDayAndHour(day, hour)
                const hourStart = hour.getHours()
                const slotId = `slot-week-${format(day, "yyyy-MM-dd")}-${hourStart}`

                return (
                  <DroppableSlot
                    key={slotId}
                    id={slotId}
                    hour={hourStart}
                    date={day}
                    onEmptyClick={(data) => onEmptySlotClick({ ...data, date: day })}
                    className="h-[60px] border border-border bg-background relative overflow-visible"
                  >
                    {/* 15-minute grid lines */}
                    <div className="absolute top-[15px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>
                    <div className="absolute top-[30px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>
                    <div className="absolute top-[45px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>

                    {/* Appointments */}
                    {hourAppointments.map((appointment) => {
                      const position = getAppointmentPosition(appointment, hourStart)
                      const durationMinutes = calculateDurationMinutes(appointment.start_time, appointment.end_time)
                      const isDraggable = appointment.status !== "cancelled" && appointment.status !== "completed"

                      return (
                        <DraggableAppointment
                          key={appointment.id}
                          id={appointment.id}
                          appointment={appointment}
                          disabled={!isDraggable}
                          style={{
                            position: "absolute",
                            left: "4px",
                            right: "4px",
                            top: `${position.top}px`,
                            height: `${position.height}px`,
                          }}
                          className={`text-xs p-1 rounded border hover:shadow-md transition-shadow ${getStatusColor(appointment.status)}`}
                        >
                          <div
                            className="w-full h-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAppointmentClick(appointment)
                            }}
                          >
                            {isDraggable && (
                              <GripVertical className="absolute right-0.5 top-0.5 w-3 h-3 text-muted-foreground/50" />
                            )}
                            <div className="font-medium truncate text-[10px]">
                              {appointment.client?.first_name || 'Client'} {appointment.client?.last_name?.[0] || 'I'}.
                            </div>
                            <div className="truncate text-[9px]">
                              {appointment.service?.name || 'Service'}
                            </div>
                            {position.height >= 30 && (
                              <div className="truncate text-[9px] font-medium">
                                {formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")} ({durationMinutes}min)
                              </div>
                            )}
                          </div>
                        </DraggableAppointment>
                      )
                    })}
                  </DroppableSlot>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Day View Component with Drag-and-Drop
function DayView({
  currentDate,
  appointments,
  onAppointmentClick,
  onEmptySlotClick,
}: {
  currentDate: Date
  appointments: Appointment[]
  onAppointmentClick: (appointment: Appointment) => void
  onEmptySlotClick: (data: { hour: number; minute: number; date: Date }) => void
}) {
  const hours = eachHourOfInterval({ start: startOfDay(new Date()), end: endOfDay(new Date()) })

  const getAppointmentsForHour = (hour: Date) => {
    return appointments.filter(appointment => {
      const aptDateStr = formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd")
      const currentDateStr = format(currentDate, "yyyy-MM-dd")

      if (aptDateStr !== currentDateStr) return false

      const aptHour = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"), 10)
      const aptEndHour = parseInt(formatInTimeZone(appointment.end_time, "Europe/Paris", "H"), 10)
      const targetHour = hour.getHours()

      return (aptHour === targetHour) || (aptHour < targetHour && aptEndHour > targetHour)
    })
  }

  const calculateDurationMinutes = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  }

  const getAppointmentPosition = (appointment: Appointment, hourStart: number) => {
    const startMinute = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "m"), 10)
    const startHour = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"), 10)

    const topOffset = startHour === hourStart ? startMinute : 0
    const durationMinutes = calculateDurationMinutes(appointment.start_time, appointment.end_time)

    return {
      top: topOffset,
      height: Math.max(durationMinutes, 15),
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-1">
        {hours.filter(hour => hour.getHours() >= 8 && hour.getHours() <= 20).map((hour) => {
          const hourAppointments = getAppointmentsForHour(hour)
          const hourStart = hour.getHours()
          const slotId = `slot-day-${format(currentDate, "yyyy-MM-dd")}-${hourStart}`

          return (
            <div key={hour.toISOString()} className="flex gap-4">
              <div className="w-20 p-2 text-sm text-muted-foreground text-right">
                {format(hour, "HH:mm")}
              </div>
              <DroppableSlot
                id={slotId}
                hour={hourStart}
                date={currentDate}
                onEmptyClick={onEmptySlotClick}
                className="flex-1 h-[60px] border border-border bg-background rounded relative overflow-visible"
              >
                {/* 15-minute grid lines */}
                <div className="absolute top-[15px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>
                <div className="absolute top-[30px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>
                <div className="absolute top-[45px] left-0 right-0 h-px bg-border/30 pointer-events-none"></div>

                {/* Appointments */}
                {hourAppointments.map((appointment) => {
                  const position = getAppointmentPosition(appointment, hourStart)
                  const durationMinutes = calculateDurationMinutes(appointment.start_time, appointment.end_time)
                  const isDraggable = appointment.status !== "cancelled" && appointment.status !== "completed"

                  return (
                    <DraggableAppointment
                      key={appointment.id}
                      id={appointment.id}
                      appointment={appointment}
                      disabled={!isDraggable}
                      style={{
                        position: "absolute",
                        left: "8px",
                        right: "8px",
                        top: `${position.top}px`,
                        height: `${position.height}px`,
                      }}
                      className={`p-2 rounded border hover:shadow-md transition-shadow ${getStatusColor(appointment.status)}`}
                    >
                      <div
                        className="w-full h-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAppointmentClick(appointment)
                        }}
                      >
                        {isDraggable && (
                          <GripVertical className="absolute right-1 top-1 w-4 h-4 text-muted-foreground/50" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                          <div className="font-medium text-sm truncate">
                            {appointment.client?.first_name || 'Client'} {appointment.client?.last_name || 'Inconnu'}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")} - {formatInTimeZone(appointment.end_time, "Europe/Paris", "HH:mm")}
                          </div>
                        </div>
                        {position.height >= 40 && (
                          <>
                            <div className="text-xs text-muted-foreground truncate mt-1">
                              {appointment.service.name}
                            </div>
                            {position.height >= 55 && (
                              <div className="text-xs text-muted-foreground truncate">
                                {appointment.staff.first_name} {appointment.staff.last_name}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </DraggableAppointment>
                  )
                })}
              </DroppableSlot>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendrierPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedSalon, setSelectedSalon] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [salons, setSalons] = useState<Salon[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  // Drag-and-drop state
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null)

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

  // Fetch salons
  useEffect(() => {
    const fetchSalons = async () => {
      try {
        const response = await fetch("/api/salons")
        if (response.ok) {
          const data = await response.json()
          setSalons(data)
        }
      } catch (error) {
        console.error("Erreur lors du chargement des salons:", error)
      }
    }
    fetchSalons()
  }, [])

  const navigate = (direction: "prev" | "next") => {
    if (direction === "prev") {
      switch (viewMode) {
        case "month":
          setCurrentDate(subMonths(currentDate, 1))
          break
        case "week":
          setCurrentDate(subWeeks(currentDate, 1))
          break
        case "day":
          setCurrentDate(subDays(currentDate, 1))
          break
      }
    } else {
      switch (viewMode) {
        case "month":
          setCurrentDate(addMonths(currentDate, 1))
          break
        case "week":
          setCurrentDate(addWeeks(currentDate, 1))
          break
        case "day":
          setCurrentDate(addDays(currentDate, 1))
          break
      }
    }
  }

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
  }

  // Handle empty slot click for quick create
  const handleEmptySlotClick = (data: { hour: number; minute: number; date: Date; staffId?: string }) => {
    // Only allow quick create if a salon is selected
    if (selectedSalon === "all") {
      toast.error("Veuillez sélectionner un salon pour créer un rendez-vous")
      return
    }

    setQuickCreateData(data)
    setIsQuickCreateOpen(true)
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const appointment = active.data.current?.appointment as Appointment
    if (appointment) {
      setActiveAppointment(appointment)
    }
  }

  // Handle drag end - update appointment time
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveAppointment(null)

    if (!over) return

    const appointment = active.data.current?.appointment as Appointment
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
    const duration = appointment.service?.duration_minutes || 60
    const newEndTime = addMinutes(newStartTime, duration)

    // Don't update if dropped in the same position
    const oldStart = new Date(appointment.start_time)
    if (
      oldStart.getHours() === newHour &&
      oldStart.getMinutes() === newMinute &&
      format(oldStart, "yyyy-MM-dd") === format(newDate, "yyyy-MM-dd")
    ) {
      return
    }

    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          ...(dropData.staffId && { staff_id: dropData.staffId }),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Erreur lors du déplacement")
      }

      toast.success("Rendez-vous déplacé", {
        description: `Nouveau créneau: ${format(newStartTime, "HH:mm")} - ${format(newEndTime, "HH:mm")}`,
        icon: <Icon icon="solar:calendar-bold" className="w-5 h-5 text-green-500" />,
      })

      // Refresh appointments
      fetchAppointments()
    } catch (error: any) {
      toast.error("Impossible de déplacer le rendez-vous", {
        description: error.message || "Le créneau est peut-être déjà occupé",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  // Fetch appointments function (extracted for reuse)
  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = format(startOfMonth(currentDate), "yyyy-MM-dd")
      const endDate = format(endOfMonth(currentDate), "yyyy-MM-dd")

      let url = `/api/appointments?start_date=${startDate}&end_date=${endDate}`
      if (selectedSalon !== "all") {
        url += `&salon_id=${selectedSalon}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAppointments(data)
      }
    } catch (error) {
      console.error("Erreur lors du chargement des rendez-vous:", error)
    } finally {
      setLoading(false)
    }
  }, [currentDate, selectedSalon])

  // Fetch appointments
  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Generate calendar grid including previous/next month days for complete weeks
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  })

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(appointment =>
      isSameDay(new Date(appointment.start_time), day)
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Calendrier des Rendez-vous</h1>
        </div>

        {/* Salon Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Filtrer par salon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedSalon} onValueChange={setSelectedSalon}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Sélectionner un salon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les salons</SelectItem>
                {salons.map((salon) => (
                  <SelectItem key={salon.id} value={salon.id}>
                    {salon.name} - {salon.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* View Selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "month" | "week" | "day")}>
                <TabsList>
                  <TabsTrigger value="month">Mois</TabsTrigger>
                  <TabsTrigger value="week">Semaine</TabsTrigger>
                  <TabsTrigger value="day">Jour</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
                className="cursor-pointer"
              >
                Aujourd'hui
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Drag-and-Drop Instructions */}
        {(viewMode === "week" || viewMode === "day") && (
          <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <GripVertical className="w-4 h-4" />
                <span>
                  <strong>Glisser-déposer:</strong> Maintenez et déplacez un rendez-vous pour le reprogrammer. Cliquez sur un créneau vide pour créer un nouveau rendez-vous.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Légende des statuts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {["confirmed", "pending", "in_progress", "completed", "cancelled", "no_show", "blocked"].map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <Badge variant="outline" className={getStatusColor(status)}>
                    {getStatusLabel(status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden lg:inline">
                    {getStatusDescription(status)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Calendar Navigation */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("prev")}
                className="cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="capitalize">
                {viewMode === "month" && format(currentDate, "MMMM yyyy", { locale: fr })}
                {viewMode === "week" && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: fr })}`}
                {viewMode === "day" && format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("next")}
                className="cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement des rendez-vous...</div>
            ) : (
              <>
                {viewMode === "month" && (
                  <div className="grid grid-cols-7 gap-1">
                    {/* Day headers */}
                    {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((day) => (
                      <div key={day} className="p-3 text-center font-semibold text-muted-foreground bg-muted/50 rounded-t">
                        {day}
                      </div>
                    ))}

                    {/* Calendar days */}
                    {calendarDays.map((day) => {
                      const dayAppointments = getAppointmentsForDay(day)
                      const isCurrentMonth = isSameMonth(day, currentDate)
                      const isToday = isSameDay(day, new Date())

                      return (
                        <div
                          key={day.toISOString()}
                          className={`min-h-[140px] p-2 border border-border ${
                            isCurrentMonth ? "bg-background" : "bg-muted/30"
                          } ${isToday ? "ring-2 ring-primary" : ""}`}
                        >
                          <div className={`text-sm font-medium mb-2 ${
                            isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                          } ${isToday ? "text-primary font-bold" : ""}`}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1">
                            {dayAppointments.slice(0, 4).map((appointment) => (
                              <div
                                key={appointment.id}
                                className={`text-xs p-1.5 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(appointment.status)}`}
                                onClick={() => handleAppointmentClick(appointment)}
                                title={`${formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")} - ${appointment.client?.first_name || 'Client'} ${appointment.client?.last_name || 'Inconnu'}
Service: ${appointment.service?.name || 'Service Inconnu'}
Thérapeute : ${appointment.staff?.first_name || 'Inconnu'} ${appointment.staff?.last_name || ''}
Salon: ${appointment.salon?.name || 'Salon Inconnu'}
Statut: ${getStatusLabel(appointment.status)}`}
                              >
                                <div className="font-medium">
                                  {formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")}
                                </div>
                                <div className="truncate">
                                  {appointment.client?.first_name || 'Client'} {appointment.client?.last_name || 'Inconnu'}
                                </div>
                                <div className="truncate text-xs opacity-75">
                                  {appointment.service?.name || 'Service Inconnu'}
                                </div>
                              </div>
                            ))}
                            {dayAppointments.length > 4 && (
                              <div className="text-xs text-muted-foreground font-medium">
                                +{dayAppointments.length - 4} autres
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {viewMode === "week" && (
                  <WeekView
                    currentDate={currentDate}
                    appointments={appointments}
                    onAppointmentClick={handleAppointmentClick}
                    onEmptySlotClick={handleEmptySlotClick}
                  />
                )}

                {viewMode === "day" && (
                  <DayView
                    currentDate={currentDate}
                    appointments={appointments}
                    onAppointmentClick={handleAppointmentClick}
                    onEmptySlotClick={handleEmptySlotClick}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Rendez-vous</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{appointments.length}</div>
              <p className="text-xs text-muted-foreground">
                {format(currentDate, "MMMM yyyy", { locale: fr })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Confirmés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {appointments.filter(a => a.status === "confirmed").length}
              </div>
              <p className="text-xs text-muted-foreground">
                Rendez-vous confirmés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {appointments.filter(a => a.status === "pending").length}
              </div>
              <p className="text-xs text-muted-foreground">
                À confirmer
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Booking Details Modal */}
        <BookingDetailsModal
          appointment={selectedAppointment}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRefetch={fetchAppointments}
        />

        {/* Quick Create Modal */}
        {selectedSalon !== "all" && (
          <QuickCreateModal
            isOpen={isQuickCreateOpen}
            onClose={() => {
              setIsQuickCreateOpen(false)
              setQuickCreateData(null)
            }}
            salonId={selectedSalon}
            prefillData={quickCreateData || undefined}
            onSuccess={fetchAppointments}
          />
        )}
      </div>

      {/* Drag Overlay for visual feedback */}
      <DragOverlay>
        {activeAppointment ? (
          <div className={`text-xs p-2 rounded border shadow-lg bg-white/90 backdrop-blur ${getStatusColor(activeAppointment.status)}`}>
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
