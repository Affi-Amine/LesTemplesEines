"use client"

import { TabletAgenda } from "@/components/calendar/tablet-agenda"
import { appointmentCollisionDetection } from "@/lib/calendar/drag-collision"
import { useAppointmentMove } from "@/lib/hooks/use-appointment-move"
import { canMoveAppointment, type MoveDestination } from "@/lib/calendar/appointment-move"
import { AppointmentMoveDialog } from "@/components/calendar/appointment-move-dialog"
import { useTabletWorkspace } from "@/lib/hooks/use-tablet-workspace"
import { CalendarClosedHours, CalendarHourLabel, isCalendarQuarterOpen } from "@/components/calendar/closed-hours"
import { getScheduleHoursIncludingAppointments } from "@/lib/calendar/scheduling"
import { AppointmentPaymentMarker } from "@/components/calendar/appointment-payment-marker"
import { AppointmentCardContent } from "@/components/calendar/appointment-card-content"
import { useState, useEffect, useMemo, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GripVertical, Plus } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays } from "date-fns"
import { fr } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { getAppointmentColor, getStatusLabel, getStatusDescription } from "@/lib/utils"
import { toast } from "sonner"
import { Icon } from "@iconify/react"

import { BookingDetailsModal } from "@/components/booking-details-modal"
import { DndContext, MouseSensor, TouchSensor, useSensors, useSensor, DragOverlay } from "@dnd-kit/core"
import { DraggableAppointment, DroppableSlot, QuickCreateModal } from "@/components/calendar"
import { AppointmentPaymentBadge, AppointmentPaymentLegend } from "@/components/appointment-payment-badge"
import { useScheduleHourHeight } from "@/lib/hooks/use-schedule-hour-height"
import { useStaff } from "@/lib/hooks/use-staff"
import {
  getAppointmentStaffIds,
  getStaffDisplayName,
  getDefaultStartTimeForDate,
  getScheduleHourRange,
  resolveOpeningHoursForDate,
  type SalonOpeningHours,
} from "@/lib/calendar/scheduling"
import type { Staff } from "@/lib/types/database"

interface Salon {
  id: string
  name: string
  city: string
  opening_hours?: SalonOpeningHours | null
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: string
  salon_id: string
  payment_status?: string
  payment_method?: string
  staff_id?: string
  client?: {
    first_name: string
    last_name: string
  }
  staff?: {
    id: string
    first_name: string
    last_name: string
  }
  assignments?: Array<{
    staff_id?: string | null
    staff?: {
      id: string
      first_name?: string
      last_name?: string
    } | null
  }>
  service?: {
    name: string
    duration_minutes: number
  }
  salon?: {
    name: string
  }
}

const STAFF_COLUMN_MIN_WIDTH = 152
const TIME_COLUMN_WIDTH = 84

// Week View Component with Drag-and-Drop
function WeekView({
  currentDate,
  appointments,
  activeAppointment,
  openingHours,
  onAppointmentClick,
  onEmptySlotClick,
  isInvalidDestination,
}: {
  currentDate: Date
  appointments: Appointment[]
  activeAppointment: Appointment | null
  openingHours?: SalonOpeningHours | null
  onAppointmentClick: (appointment: Appointment) => void
  onEmptySlotClick: (data: { hour: number; minute: number; date: Date }) => void
  isInvalidDestination: (destination: MoveDestination) => boolean
}) {
  const hourHeight = Math.max(120, useScheduleHourHeight())
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from(
    new Set(weekDays.flatMap((day) => getScheduleHoursIncludingAppointments(openingHours, day, appointments)))
  ).sort((a, b) => a - b)

  const getAppointmentsForDayAndHour = (day: Date, hour: number) => {
    return appointments.filter(appointment => {
      if (["cancelled", "no_show"].includes(appointment.status)) return false
      const aptDateStr = formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd")
      const dayDateStr = format(day, "yyyy-MM-dd")

      if (aptDateStr !== dayDateStr) return false

      const aptHour = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"), 10)
      return aptHour === hour
    })
  }

  const getAppointmentTitle = (appointment: Appointment) => {
    if (appointment.status === "blocked") return "Créneau bloqué"
    return `${appointment.client?.first_name || "Client"} ${appointment.client?.last_name?.[0] || "I"}.`
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
      top: (topOffset / 60) * hourHeight,
      height: Math.max((durationMinutes / 60) * hourHeight, 24),
    }
  }

  const isInvalidSlotForActive = (day: Date, hour: number, minute: number) =>
    isInvalidDestination({ date: day, hour, minute })

  return (
    <div className="overflow-x-hidden md:overflow-x-auto">
      <div className="min-w-0 md:min-w-[1100px]">
        {/* Header with days */}
        <div className="mb-2 grid grid-cols-8 gap-0.5 sm:mb-4 sm:gap-1">
          <div className="p-1 sm:p-2"></div>
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="min-w-0 p-1 text-center font-medium sm:p-2">
              <div className="truncate text-[10px] opacity-80 sm:text-sm">
                {format(day, "EEE", { locale: fr })}
              </div>
              <div className={`text-sm sm:text-lg ${isSameDay(day, new Date()) ? "text-primary font-bold" : ""}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="space-y-1">
          {hours.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Le salon est fermé sur cette semaine.
            </div>
          ) : hours.map((hourStart) => (
            <div key={hourStart} className="grid grid-cols-8 gap-0.5 sm:gap-1">
              <div className="pt-1 pr-0.5 text-right text-[9px] text-muted-foreground sm:p-2 sm:text-sm">
                {`${hourStart.toString().padStart(2, "0")}:00`}
              </div>
              {weekDays.map((day) => {
                const isOpenHour = getScheduleHourRange(openingHours, day).includes(hourStart)
                const hourAppointments = getAppointmentsForDayAndHour(day, hourStart)
                const slotId = `slot-week-${format(day, "yyyy-MM-dd")}-${hourStart}`

                return (
                  <div key={slotId} style={{ height: hourHeight }} className={`relative min-w-0 rounded border border-border ${isOpenHour ? "bg-background" : "bg-muted/30"}`}>
                    <CalendarClosedHours hour={hourStart} date={day} openingHours={openingHours} />
                    {isOpenHour ? (
                      <div className="absolute inset-0 grid grid-rows-4">
                        {[0, 15, 30, 45].map((minute, idx) => (
                          <DroppableSlot
                            key={`${slotId}-${minute}`}
                            id={`${slotId}-${minute}`}
                            hour={hourStart}
                            minute={minute}
                            date={day}
                            onEmptyClick={(data) => onEmptySlotClick({ ...data, date: day })}
                            disabled={!isCalendarQuarterOpen(hourStart, minute, day, openingHours)}
                            isInvalidDrop={isInvalidSlotForActive(day, hourStart, minute)}
                            isDragActive={Boolean(activeAppointment)}
                            className={`${idx < 3 ? "border-b border-border/30" : ""}`}
                          >
                            <div />
                          </DroppableSlot>
                        ))}
                      </div>
                    ) : null}

                    {hourAppointments.map((appointment) => {
                      const position = getAppointmentPosition(appointment, hourStart)
                      const isDraggable = canMoveAppointment(appointment)

                      return (
                        <DraggableAppointment
                          key={appointment.id}
                          id={appointment.id}
                          appointment={appointment}
                          disabled={!isDraggable}
                          style={{
                            position: "absolute",
                            left: "1px",
                            right: "1px",
                            top: `${position.top}px`,
                            height: `${position.height}px`,
                          }}
                          className={`overflow-hidden rounded border p-0.5 text-[8px] transition-shadow hover:shadow-md sm:p-1 sm:text-xs ${getAppointmentColor(appointment)}`}
                        >
                          <div
                            className="w-full h-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAppointmentClick(appointment)
                            }}
                          >
                            <AppointmentCardContent appointment={appointment} height={position.height} />
                        </div>
                    </DraggableAppointment>
                      )
                    })}
                  </div>
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
  staffMembers,
  activeAppointment,
  openingHours,
  onAppointmentClick,
  onEmptySlotClick,
  isInvalidDestination,
}: {
  currentDate: Date
  appointments: Appointment[]
  staffMembers: Staff[]
  activeAppointment: Appointment | null
  openingHours?: SalonOpeningHours | null
  onAppointmentClick: (appointment: Appointment) => void
  onEmptySlotClick: (data: { hour: number; minute: number; date: Date; staffId?: string }) => void
  isInvalidDestination: (destination: MoveDestination) => boolean
}) {
  const hours = getScheduleHoursIncludingAppointments(openingHours, currentDate, appointments)
  const hourHeight = useScheduleHourHeight()
  const activeStaffMembers = staffMembers.filter((member) => member.is_active !== false)
  const scheduleMinWidth = TIME_COLUMN_WIDTH + Math.max(activeStaffMembers.length, 1) * STAFF_COLUMN_MIN_WIDTH

  const getAppointmentsForHour = (hour: number, staffId?: string) => {
    return appointments.filter(appointment => {
      if (["cancelled", "no_show"].includes(appointment.status)) return false
      const aptDateStr = formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd")
      const currentDateStr = format(currentDate, "yyyy-MM-dd")

      if (aptDateStr !== currentDateStr) return false

      const aptHour = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"), 10)
      if (aptHour !== hour) return false
      return staffId ? getAppointmentStaffIds(appointment).includes(staffId) : true
    })
  }

  const getAppointmentTitle = (appointment: Appointment) => {
    if (appointment.status === "blocked") return "Créneau bloqué"
    return `${appointment.client?.first_name || "Client"} ${appointment.client?.last_name || "Inconnu"}`
  }

  const calculateDurationMinutes = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  }

  const getAppointmentPosition = (appointment: Appointment, hourStart: number) => {
    const startMinute = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "m"), 10)
    const startHour = parseInt(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"), 10)

    const topOffset = startHour === hourStart ? (startMinute / 60) * hourHeight : 0
    const durationMinutes = calculateDurationMinutes(appointment.start_time, appointment.end_time)

    return {
      top: topOffset,
      height: Math.max((durationMinutes / 60) * hourHeight, 20),
    }
  }

  const isInvalidSlotForActive = (hour: number, minute: number, staffId?: string) =>
    isInvalidDestination({ date: currentDate, hour, minute, staffId })

  return (
    <div className="overflow-x-hidden md:overflow-x-auto">
      <div
        className="min-w-0 space-y-1 md:min-w-[var(--schedule-min-width)]"
        style={{ "--schedule-min-width": activeStaffMembers.length > 0 ? `${scheduleMinWidth}px` : undefined } as CSSProperties}
      >
        {activeStaffMembers.length > 0 ? (
          <div className="sticky top-0 z-20 mb-3 flex border-b border-border bg-card/95 pb-2 backdrop-blur">
            <div className="w-10 shrink-0 md:w-[84px]"></div>
            {activeStaffMembers.map((member) => (
              <div key={member.id} className="min-w-0 flex-1 border-l border-border px-0.5 text-center md:min-w-[152px] md:px-2">
                <div className="truncate text-[10px] font-semibold md:text-sm lg:text-base">{getStaffDisplayName(member)}</div>
                <div className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:block">Masseuse</div>
              </div>
            ))}
          </div>
        ) : null}

        {hours.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Salon fermé ce jour.
          </div>
        ) : activeStaffMembers.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Sélectionnez un salon pour afficher les colonnes masseuses.
          </div>
        ) : hours.map((hourStart) => {
          const slotId = `slot-day-${format(currentDate, "yyyy-MM-dd")}-${hourStart}`

          return (
            <div key={hourStart} className="flex border-t border-border" style={{ height: hourHeight }}>
              <div className="w-10 shrink-0 bg-card pr-1 pt-1 text-right text-[10px] font-medium text-muted-foreground md:w-[84px] md:p-2 md:text-sm">
                <CalendarHourLabel hour={hourStart} date={currentDate} openingHours={openingHours} />
              </div>
              {activeStaffMembers.map((member) => {
                const hourAppointments = getAppointmentsForHour(hourStart, member.id)

                return (
                  <div key={`${member.id}-${hourStart}`} className="relative min-w-0 flex-1 border-l border-border bg-background/80 md:min-w-[152px]">
                    <CalendarClosedHours hour={hourStart} date={currentDate} openingHours={openingHours} />
                    <div className="absolute inset-0 grid grid-rows-4">
                      {[0, 15, 30, 45].map((minute, idx) => (
                        <DroppableSlot
                          key={`${slotId}-${member.id}-${minute}`}
                          id={`${slotId}-${member.id}-${minute}`}
                          hour={hourStart}
                          minute={minute}
                          staffId={member.id}
                          date={currentDate}
                          onEmptyClick={(data) => onEmptySlotClick({ ...data, staffId: member.id })}
                          disabled={!isCalendarQuarterOpen(hourStart, minute, currentDate, openingHours)}
                          isInvalidDrop={isInvalidSlotForActive(hourStart, minute, member.id)}
                          isDragActive={Boolean(activeAppointment)}
                          className={`${idx < 3 ? "border-b border-dashed border-border/50" : ""} min-h-[19px]`}
                        >
                          <div />
                        </DroppableSlot>
                      ))}
                    </div>

                    {hourAppointments.map((appointment) => {
                  const position = getAppointmentPosition(appointment, hourStart)
                  const isDraggable = canMoveAppointment(appointment)

                  return (
                    <DraggableAppointment
                      key={appointment.id}
                      id={appointment.id}
                      appointment={appointment}
                      disabled={!isDraggable}
                      style={{
                        position: "absolute",
                        left: "1px",
                        right: "1px",
                        top: `${position.top}px`,
                        height: `${position.height}px`,
                      }}
                      className={`overflow-hidden rounded-[4px] border p-0.5 text-[9px] shadow-sm transition-shadow hover:shadow-md md:rounded-md md:border-2 md:p-1 md:text-xs ${getAppointmentColor(appointment)}`}
                    >
                      <div
                        className="w-full h-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAppointmentClick(appointment)
                        }}
                      >
                        <AppointmentCardContent appointment={appointment} height={position.height} />
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
  )
}

export default function CalendrierPage() {
  const isTablet = useTabletWorkspace()
  const [showOverview, setShowOverview] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedSalon, setSelectedSalon] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [salons, setSalons] = useState<Salon[]>([])
  const dailyWorkspace = isTablet && !showOverview
  const startDate = dailyWorkspace ? format(currentDate, "yyyy-MM-dd") : format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const endDate = dailyWorkspace ? startDate : format(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const { data: appointments = [], isFetching: loading, isPending: initialLoading, isError: appointmentsError, refetch: fetchAppointments } = useQuery({
    queryKey: ["appointments", "calendar", selectedSalon, startDate, endDate],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ start_date: startDate, end_date: endDate })
      if (selectedSalon !== "all") query.set("salon_id", selectedSalon)
      return fetchAPI<Appointment[]>(`/appointments?${query}`, { signal, cache: "no-store" })
    },
    staleTime: 0,
    refetchInterval: 30_000,
  })
  const selectedSalonData = useMemo(
    () => salons.find((salon) => salon.id === selectedSalon) || null,
    [salons, selectedSalon]
  )
  const { data: selectedSalonStaff = [], isLoading: staffLoading } = useStaff(selectedSalon !== "all" ? selectedSalon : undefined)
  const selectedOpeningHours = selectedSalonData ? selectedSalonData.opening_hours || null : undefined
  const selectedDayHours = resolveOpeningHoursForDate(selectedOpeningHours, currentDate)

  // Quick create modal state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [quickCreateData, setQuickCreateData] = useState<{
    date: Date
    hour: number
    minute: number
    staffId?: string
  } | null>(null)

  useEffect(() => {
    setSelectedAppointment(null)
    setIsModalOpen(false)
    setIsQuickCreateOpen(false)
    setQuickCreateData(null)
    cancelMove()
    handleDragCancel()
  }, [selectedSalon])

  // Mouse-only dragging keeps touch gestures available for native scrolling and tapping.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  // Fetch salons
  useEffect(() => {
    const fetchSalons = async () => {
      try {
        const response = await fetch("/api/salons?include_inactive=true")
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

  const handleOpenQuickCreate = () => {
    const defaultTime = getDefaultStartTimeForDate(selectedOpeningHours, currentDate)
    const [hour, minute] = defaultTime.split(":").map((value) => Number.parseInt(value, 10))

    handleEmptySlotClick({
      date: currentDate,
      hour: Number.isNaN(hour) ? 9 : hour,
      minute: Number.isNaN(minute) ? 0 : minute,
    })
  }

  const { activeAppointment, pendingMove, isMovingAppointment, moveError, handleDragStart, handleDragEnd,
    handleDragCancel, confirmMove, cancelMove, isInvalidDestination } = useAppointmentMove({
      appointments, staff: selectedSalonStaff, openingHours: selectedOpeningHours, onRefresh: fetchAppointments,
    })

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
    const dayDateStr = format(day, "yyyy-MM-dd")
    return appointments.filter(appointment =>
      !["cancelled", "no_show"].includes(appointment.status) && formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd") === dayDateStr
    )
  }

  return (
    <DndContext
      collisionDetection={appointmentCollisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={dailyWorkspace ? "" : "space-y-4 p-3 sm:space-y-6 sm:p-6"}>
        {dailyWorkspace ? <>
          {appointmentsError && <p role="alert" className="bg-destructive/10 p-3 text-sm">Le planning n’a pas pu être actualisé. <Button variant="outline" onClick={() => void fetchAppointments()}>Réessayer</Button></p>}
          <TabletAgenda
            salonName={selectedSalonData?.name || "Tous les salons"}
            date={currentDate}
            onDateChange={setCurrentDate}
            staff={selectedSalonStaff.filter(member => member.is_active !== false)}
            appointments={appointments}
            hours={getScheduleHoursIncludingAppointments(selectedOpeningHours, currentDate, appointments)}
            openingHours={selectedOpeningHours}
            loading={initialLoading || staffLoading}
            onAppointmentClick={handleAppointmentClick}
            onEmptySlotClick={handleEmptySlotClick}
            onCreate={handleOpenQuickCreate}
            movingAppointment={activeAppointment}
            isInvalidDestination={isInvalidDestination}
            summary={<><AppointmentPaymentLegend /><Button variant="outline" onClick={() => setShowOverview(true)}>Vue mois ou semaine</Button></>}
            salonControl={<select aria-label="Salon du planning" value={selectedSalon} onChange={event => setSelectedSalon(event.target.value)} className="h-11 max-w-[180px] min-w-0 rounded-lg border bg-card px-2 text-sm">
              <option value="all">Tous les salons</option>
              {salons.map(salon => <option key={salon.id} value={salon.id}>{salon.name}</option>)}
            </select>}
          />
        </> : <>
        {isTablet && <Button variant="outline" onClick={() => setShowOverview(false)}>Retour à l’agenda tactile</Button>}

        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Calendrier des Rendez-vous</h1>
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
              <SelectTrigger className="w-full sm:w-64">
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "month" | "week" | "day")}>
                <TabsList>
                  <TabsTrigger value="month">Mois</TabsTrigger>
                  <TabsTrigger value="week">Semaine</TabsTrigger>
                  <TabsTrigger value="day">Jour</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => setCurrentDate(new Date())}
                  className="cursor-pointer"
                >
                  Aujourd'hui
                </Button>
                <Button onClick={handleOpenQuickCreate} className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Drag-and-Drop Instructions */}
        {(viewMode === "week" || viewMode === "day") && (
          <Card className="border-l-4 border-l-blue-400 bg-muted/30">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <GripVertical className="w-4 h-4" />
                <span>
                  <strong>Glisser-déposer:</strong> déplace tout le rendez-vous et toute l'équipe. Pour remplacer une seule masseuse, ouvrez le rendez-vous.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {appointmentsError && (
          <div role="alert" className="rounded-md border border-destructive/30 p-4 text-destructive">
            Impossible de charger le planning de ce salon.
            <Button variant="outline" onClick={() => void fetchAppointments()} className="ml-3">Réessayer</Button>
          </div>
        )}
        {selectedSalonData && (
          <Card>
            <CardContent className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="font-medium">Horaires du jour</div>
              <div className="text-muted-foreground">
                {selectedDayHours
                  ? `${selectedDayHours.open} - ${selectedDayHours.close}`
                  : "Salon fermé"}
              </div>
            </CardContent>
          </Card>
        )}

        <AppointmentPaymentLegend />

        {/* Legend */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Légende des statuts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 lg:grid-cols-7">
              {["confirmed", "pending", "in_progress", "completed", "cancelled", "no_show", "blocked"].map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <Badge variant="outline" className={getAppointmentColor({ status })}>
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
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("prev")}
                aria-label="Période précédente"
                className="h-9 w-9 shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="min-w-0 text-center text-base capitalize sm:text-xl">
                {viewMode === "month" && format(currentDate, "MMMM yyyy", { locale: fr })}
                {viewMode === "week" && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: fr })}`}
                {viewMode === "day" && format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("next")}
                aria-label="Période suivante"
                className="h-9 w-9 shrink-0 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3 sm:px-6 sm:pb-6">
            {appointmentsError ? (
              <div className="text-center py-8 text-muted-foreground">Planning indisponible.</div>
            ) : loading ? (
              <div className="text-center py-8">Chargement des rendez-vous...</div>
            ) : (
              <>
                {viewMode === "month" && (
                  <>
                    <div className="grid grid-cols-7 overflow-hidden rounded-md border border-border md:hidden">
                      {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map((day) => (
                        <div key={day} className="border-b border-border bg-muted/50 py-2 text-center text-[11px] font-bold text-muted-foreground">
                          {day}
                        </div>
                      ))}

                      {calendarDays.map((day) => {
                        const dayAppointments = getAppointmentsForDay(day)
                        const isCurrentMonth = isSameMonth(day, currentDate)
                        const isToday = isSameDay(day, new Date())

                        return (
                          <button
                            key={day.toISOString()}
                            type="button"
                            className={`min-w-0 border-b border-r border-border p-1 text-left ${
                              isCurrentMonth ? "bg-background" : "bg-muted/30"
                            } ${isToday ? "ring-2 ring-inset ring-primary" : ""}`}
                            onClick={() => {
                              setCurrentDate(day)
                              if (dayAppointments[0]) {
                                handleAppointmentClick(dayAppointments[0])
                              }
                            }}
                          >
                            <div className={`mb-1 text-[11px] font-bold leading-none ${
                              isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                            } ${isToday ? "text-primary" : ""}`}>
                              {format(day, "d")}
                            </div>
                            <div className="flex min-h-[54px] flex-col gap-0.5">
                              {dayAppointments.slice(0, 3).map((appointment) => (
                                <div
                                  key={appointment.id}
                                  className={`@container relative flex min-h-8 items-end justify-between gap-0.5 overflow-hidden rounded-[3px] border px-0.5 pt-3.5 text-[8px] font-bold leading-4 ${getAppointmentColor(appointment)}`}
                                  title={`${formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")} - ${appointment.client?.first_name || 'Client'} ${appointment.client?.last_name || 'Inconnu'}`}
                                >
                                  <span>{formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")}</span>
                                  <AppointmentPaymentMarker appointment={appointment} />
                                </div>
                              ))}
                              {dayAppointments.length > 3 && (
                                <div className="rounded-[3px] bg-muted px-0.5 text-center text-[8px] font-bold leading-4 text-muted-foreground">
                                  +{dayAppointments.length - 3}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <div className="hidden grid-cols-7 gap-1 md:grid">
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
                                  className={`@container relative text-xs p-1.5 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getAppointmentColor(appointment)}`}
                                  onClick={() => handleAppointmentClick(appointment)}
                                  title={`${formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")} - ${appointment.client?.first_name || 'Client'} ${appointment.client?.last_name || 'Inconnu'}
Service: ${appointment.service?.name || (appointment.status === "blocked" ? 'Créneau bloqué' : 'Service Inconnu')}
Masseuse : ${appointment.staff?.first_name || 'Inconnu'} ${appointment.staff?.last_name || ''}
Salon: ${appointment.salon?.name || 'Salon Inconnu'}
Statut: ${getStatusLabel(appointment.status)}`}
                                >
                                  <AppointmentPaymentMarker appointment={appointment} />
                                  <div className="flex items-center justify-between gap-1 pr-4 font-medium">
                                    <span>{formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")}</span>
                                  </div>
                                  <div className="truncate">
                                    {appointment.status === "blocked"
                                      ? "Créneau bloqué"
                                      : `${appointment.client?.first_name || 'Client'} ${appointment.client?.last_name || 'Inconnu'}`}
                                  </div>
                                  <div className="truncate text-xs opacity-75">
                                    {appointment.service?.name || (appointment.status === "blocked" ? "Indisponible" : 'Service Inconnu')}
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
                  </>
                )}

                {viewMode === "week" && (
                  <WeekView
                    isInvalidDestination={isInvalidDestination}
                    currentDate={currentDate}
                    appointments={appointments}
                    activeAppointment={activeAppointment}
                    openingHours={selectedOpeningHours}
                    onAppointmentClick={handleAppointmentClick}
                    onEmptySlotClick={handleEmptySlotClick}
                  />
                )}

                {viewMode === "day" && (
                  <DayView
                    isInvalidDestination={isInvalidDestination}
                    currentDate={currentDate}
                    appointments={appointments}
                    staffMembers={selectedSalon !== "all" ? selectedSalonStaff : []}
                    activeAppointment={activeAppointment}
                    openingHours={selectedOpeningHours}
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

        </>}

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
            existingAppointments={appointments}
            openingHours={selectedOpeningHours}
            onSuccess={fetchAppointments}
          />
        )}

        <AppointmentMoveDialog move={pendingMove} staff={selectedSalonStaff} saving={isMovingAppointment}
          error={moveError} onCancel={cancelMove} onConfirm={() => void confirmMove()} />
      </div>

      {/* Drag Overlay for visual feedback */}
      <DragOverlay>
        {activeAppointment ? (
            <div className={`text-xs p-2 rounded border shadow-lg backdrop-blur ${getAppointmentColor(activeAppointment)}`}>
              <div className="font-medium">
              {activeAppointment.status === "blocked"
                ? "Créneau bloqué"
                : `${activeAppointment.client?.first_name || "Client"} ${activeAppointment.client?.last_name?.[0] || "I"}.`}
              </div>
              <div className="truncate opacity-80">
              {activeAppointment.service?.name || (activeAppointment.status === "blocked" ? "Indisponible" : "Service")}
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
