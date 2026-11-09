"use client"

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { addDays, format } from "date-fns"
import { fr } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, List, LayoutGrid, SlidersHorizontal, Ban } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AppointmentCardContent, RELEASED_CARD_CLASS } from "@/components/calendar/appointment-card-content"
import { AppointmentPaymentLegend } from "@/components/appointment-payment-badge"
import { hasClientRequestedStaff } from "@/lib/calendar/staff-choice"
import { appointmentMarkerLaneWidth } from "@/lib/calendar/marker-layout"
import { getAppointmentServiceColors } from "@/lib/calendar/service-colors"
import { AppointmentServiceColorKey } from "@/components/calendar/appointment-service-stars"
import { PrestationCounts } from "@/components/calendar/prestation-counts"
import { CalendarClosedHours, CalendarHourLabel, isCalendarQuarterOpen } from "@/components/calendar/closed-hours"
import { getAppointmentDurationMinutes, getAppointmentStaffIds, getLaneBox, getStaffDisplayName, isBookedAppointment, isReleasedAppointment, layoutAppointmentLanes, type SalonOpeningHours } from "@/lib/calendar/scheduling"
import { getAppointmentColor } from "@/lib/utils"
import { DraggableAppointment } from "@/components/calendar/draggable-appointment"
import { canMoveAppointment, type AppointmentMoveMode, type MoveDestination } from "@/lib/calendar/appointment-move"

type Member = { id: string; first_name?: string | null; last_name?: string | null }
type Booking = { id: string; start_time: string; end_time: string; status: string; [key: string]: any }
type Slot = { date: Date; hour: number; minute: number; staffId?: string }

interface TabletAgendaProps {
  salonName: string
  date: Date
  onDateChange: (date: Date) => void
  staff: Member[]
  appointments: Booking[]
  hours: number[]
  openingHours?: SalonOpeningHours | null
  loading?: boolean
  onAppointmentClick: (appointment: any) => void
  onEmptySlotClick: (slot: Slot) => void
  onCreate: () => void
  onBlock?: () => void
  summary: ReactNode
  salonControl?: ReactNode
  salonTitleControl?: ReactNode
  movingAppointment?: Booking | null
  isInvalidDestination?: (destination: MoveDestination) => boolean
  moveModePolicy?: AppointmentMoveMode
  toolbarAction?: ReactNode
  /** Dragging a card's bottom grip sets a new end for that booking. */
  onResize?: (appointment: Booking, endTime: string) => void
}

function getBookedServices(appointment: Booking) {
  const services = new Map<string, string>()
  for (const service of [...(appointment.service_items || []), ...(appointment.planning_services || [])]) {
    if (service?.id) services.set(service.id, service.name || services.get(service.id) || "Prestation")
  }
  const primaryId = appointment.service_id || appointment.service?.id
  if (primaryId && !services.has(primaryId)) services.set(primaryId, appointment.service?.name || "Prestation")
  return [...services].map(([id, name]) => ({ id, name }))
}

/** Grip under a booking: drag it to set how long the care actually lasts. */
function ResizeHandle({ pxPerMinute, onPreview, onCommit }: {
  pxPerMinute: number
  onPreview: (deltaMinutes: number) => void
  onCommit: (deltaMinutes: number) => void
}) {
  const quarters = (clientY: number, from: number) => Math.round((clientY - from) / pxPerMinute / 15) * 15
  return <span
    role="separator"
    aria-label="Changer la durée du rendez-vous"
    aria-orientation="horizontal"
    className="absolute inset-x-0 bottom-0 z-20 h-3 cursor-ns-resize touch-none rounded-b-lg bg-current/10 after:absolute after:inset-x-0 after:bottom-[3px] after:mx-auto after:h-0.5 after:w-6 after:rounded-full after:bg-current/40 after:content-['']"
    onClick={event => event.stopPropagation()}
    onTouchStart={event => event.stopPropagation()}
    onPointerDown={event => {
      // The card above is draggable: this grip must not start a move.
      event.preventDefault()
      event.stopPropagation()
      const handle = event.currentTarget
      const from = event.clientY
      handle.setPointerCapture(event.pointerId)
      const move = (pointer: PointerEvent) => onPreview(quarters(pointer.clientY, from))
      const done = (pointer: PointerEvent) => {
        handle.releasePointerCapture(pointer.pointerId)
        handle.removeEventListener("pointermove", move)
        handle.removeEventListener("pointerup", done)
        handle.removeEventListener("pointercancel", cancel)
        onCommit(quarters(pointer.clientY, from))
      }
      const cancel = () => {
        handle.removeEventListener("pointermove", move)
        handle.removeEventListener("pointerup", done)
        handle.removeEventListener("pointercancel", cancel)
        onPreview(0)
      }
      handle.addEventListener("pointermove", move)
      handle.addEventListener("pointerup", done)
      handle.addEventListener("pointercancel", cancel)
    }}
  />
}

/** An empty quarter: tap it to book, or drop a booking on it to move it there. */
function AgendaSlot({ id, destination, invalid, closed, allowClosedDrop, height, disabled, label, onCreate, dragging }: {
  id: string; destination: MoveDestination; invalid: boolean; closed: boolean; height: number
  allowClosedDrop: boolean; disabled: boolean; label: string; onCreate: () => void; dragging: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: destination, disabled: disabled || (closed && !allowClosedDrop) })
  const refused = invalid || (closed && !allowClosedDrop)
  return <button ref={setNodeRef} type="button" data-calendar-slot={id} data-drop-over={isOver} data-drop-invalid={refused}
    disabled={closed || disabled} aria-label={label} onClick={() => { if (!dragging) onCreate() }}
    className={`min-h-0 w-full border-b border-dashed border-border/60 bg-transparent text-left last:border-b-0 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default enabled:active:bg-primary/10 ${
      isOver ? refused ? "bg-destructive/20 ring-2 ring-inset ring-destructive" : "bg-primary/20 ring-2 ring-inset ring-primary"
        : dragging && refused ? "bg-destructive/5" : ""}`}
    style={{ height }} />
}

// Every cell is a native button and also a drop target: tap to book, hold and
// drag a booking to move it. The sensors' hold delay keeps the page scrollable.
export const TabletAgenda = memo(function TabletAgenda({
  salonName, date, onDateChange, staff, appointments, hours, openingHours, loading,
  onAppointmentClick, onEmptySlotClick, onCreate, onBlock, summary, salonControl, salonTitleControl, movingAppointment, isInvalidDestination,
  moveModePolicy = "strict", toolbarAction, onResize,
}: TabletAgendaProps) {
  const [resizing, setResizing] = useState<{ id: string; delta: number } | null>(null)
  const root = useRef<HTMLElement>(null)
  const teamScroll = useRef<HTMLDivElement>(null)
  const [memberId, setMemberId] = useState("all")
  const [interval, setInterval] = useState<15 | 30>(30)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [showAllHours, setShowAllHours] = useState(false)
  const [serviceId, setServiceId] = useState("all")
  const dayKey = formatInTimeZone(date, "Europe/Paris", "yyyy-MM-dd")
  const hourHeight = interval === 30 ? 96 : 180
  const displayHours = moveModePolicy === "salon-admin" && showAllHours ? Array.from({ length: 24 }, (_, hour) => hour) : hours
  useEffect(() => { setShowAllHours(false) }, [dayKey, salonName, moveModePolicy])

  const activeMember = staff.find(member => member.id === memberId)
  const visibleStaff = activeMember ? [activeMember] : staff
  // Cancelled and absent bookings stay on the planning as a trace; they never block a slot.
  const allDayAppointments = useMemo(() => appointments.filter(appointment =>
    formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd") === dayKey
  ).sort((a, b) => a.start_time.localeCompare(b.start_time)), [appointments, dayKey])

  // Prestations actually booked that day, so the filter never offers an empty choice.
  const dayServices = useMemo(() => {
    const map = new Map<string, string>()
    for (const appointment of allDayAppointments) {
      for (const service of getBookedServices(appointment)) map.set(service.id, service.name)
    }
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fr"))
  }, [allDayAppointments])

  // Changing day may leave the chosen prestation unbooked: fall back to showing everything
  // rather than an empty planning the staff cannot explain.
  const activeServiceId = dayServices.some(service => service.id === serviceId) ? serviceId : "all"
  const activeService = dayServices.find(service => service.id === activeServiceId)
  const dayAppointments = useMemo(() => activeServiceId === "all" ? allDayAppointments
    : allDayAppointments.filter(appointment => getBookedServices(appointment).some(service => service.id === activeServiceId)),
    [allDayAppointments, activeServiceId])
  const byStaff = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const appointment of dayAppointments) {
      for (const id of getAppointmentStaffIds(appointment)) {
        const items = map.get(id) || []
        items.push(appointment)
        map.set(id, items)
      }
    }
    return map
  }, [dayAppointments])
  const lanesByStaff = useMemo(() => new Map([...byStaff].map(([id, items]) => [id, layoutAppointmentLanes(items)])), [byStaff])
  // A narrow phone must not squeeze ten columns, or overlapping bookings, into unreadable strips.
  const columnWidths = visibleStaff.map(member => {
    const lanes = Math.max(1, ...[...(lanesByStaff.get(member.id)?.values() || [])].map(lane => lane.lanes))
    const bookings = byStaff.get(member.id) || []
    const laneWidth = appointmentMarkerLaneWidth(bookings)
    const hasShortBooking = bookings.some(appointment => appointment.status !== "blocked" && getAppointmentDurationMinutes(appointment) < 30)
    const hasColor = bookings.some(appointment => getAppointmentServiceColors(appointment).length > 0)
    return lanes > 1 ? lanes * laneWidth : hasShortBooking ? laneWidth : hasColor ? Math.max(104, laneWidth) : bookings.some(hasClientRequestedStaff) ? 104 : 72
  })
  const columns = "var(--agenda-columns)"
  const columnStyle = {
    "--agenda-columns-wide": `40px ${columnWidths.map(width => `minmax(${width}px, 1fr)`).join(" ") || "1fr"}`,
    "--agenda-columns-phone": `40px ${columnWidths.map(width => `minmax(${Math.max(120, width)}px, 1fr)`).join(" ") || "1fr"}`,
    "--agenda-min-width-wide": `${40 + columnWidths.reduce((sum, width) => sum + width, 0)}px`,
    "--agenda-min-width-phone": `${40 + columnWidths.reduce((sum, width) => sum + Math.max(120, width), 0)}px`,
  } as CSSProperties
  const changeDate = (next: Date) => onDateChange(next)
  const selectClass = "h-11 min-w-0 rounded-lg border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return <section ref={root} data-tablet-agenda style={columnStyle} aria-label={`Agenda de ${salonName}`} className="min-w-0 bg-background">
    <div data-agenda-toolbar className="sticky top-16 z-30 border-b bg-card">
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Les Temples · Agenda</p>
          <h1 className="truncate text-lg font-semibold tracking-tight">{salonTitleControl || salonName}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">{toolbarAction}<Button variant="ghost" onClick={() => setSummaryOpen(true)} aria-label="Résumé et repères du planning" className="h-11 shrink-0 gap-2 px-3">
          <span className="hidden text-sm sm:inline">Résumé</span><SlidersHorizontal className="h-5 w-5" />
        </Button></div>
      </div>

      <div className="px-3 pb-2 sm:px-5"><PrestationCounts appointments={dayAppointments} /></div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Jour précédent" onClick={() => changeDate(addDays(date, -1))} className="h-11 w-11"><ChevronLeft /></Button>
          <Button variant="ghost" onClick={() => setCalendarOpen(true)} aria-label="Choisir la date du planning" className="h-11 gap-2 px-2 text-sm sm:px-3">
            <CalendarDays className="h-4 w-4" /><span className="capitalize">{format(date, "EEE d MMM", { locale: fr })}</span>
          </Button>
          <Button variant="outline" size="icon" aria-label="Jour suivant" onClick={() => changeDate(addDays(date, 1))} className="h-11 w-11"><ChevronRight /></Button>
          <Button variant="ghost" onClick={() => changeDate(new Date())} className="hidden h-11 px-3 sm:inline-flex">Aujourd’hui</Button>
        </div>
        <div className="flex gap-2">
          <Button onClick={onCreate} disabled={loading} className="h-11 gap-2 rounded-lg px-3 sm:px-4"><Plus className="h-5 w-5" /><span className="hidden min-[420px]:inline">Rendez-vous</span><span className="min-[420px]:hidden">RDV</span></Button>
        </div>
      </div>

      {view === "grid" && (moveModePolicy === "salon-admin" || movingAppointment) && <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-t bg-primary/5 px-3 py-1 text-xs sm:px-5">
        <p className="min-w-0 flex-1 basis-full sm:basis-0">{moveModePolicy === "salon-admin" ? "Maintenez un rendez-vous puis glissez-le. Les chevauchements sont autorisés et chaque déplacement est enregistré dans le journal." : "Déposez le rendez-vous sur le nouvel horaire. Les zones rouges sont indisponibles."}</p>
        {moveModePolicy === "salon-admin" && <Button variant="outline" aria-pressed={showAllHours} onClick={() => setShowAllHours(value => !value)} className="h-11 shrink-0 px-2 text-xs">{showAllHours ? "Horaires du salon" : "Afficher les 24 h"}</Button>}
      </div>}

      {activeService && <div role="status" className="flex items-center justify-between gap-3 border-t bg-amber-50 px-3 py-1 text-xs text-amber-900 sm:px-5">
        <span>Planning filtré sur « {activeService.name} » : les autres rendez-vous sont masqués.</span>
        <Button variant="ghost" onClick={() => setServiceId("all")} className="h-9 shrink-0 text-amber-900">Tout afficher</Button>
      </div>}

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2 sm:px-5">
        {salonControl}
        <select aria-label="Afficher une masseuse" value={activeMember ? memberId : "all"} onChange={event => setMemberId(event.target.value)} className={`${selectClass} max-w-[170px] flex-1`}>
          <option value="all">Toute l’équipe</option>
          {staff.map(member => <option key={member.id} value={member.id}>{getStaffDisplayName(member)}</option>)}
        </select>
        <select aria-label="Filtrer par prestation" value={activeServiceId} onChange={event => setServiceId(event.target.value)} className={`${selectClass} max-w-[190px] flex-1`}>
          <option value="all">Toutes les prestations</option>
          {dayServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select>
        <select aria-label="Précision du planning" value={interval} onChange={event => setInterval(Number(event.target.value) as 15 | 30)} className={selectClass}>
          <option value={30}>30 min</option><option value={15}>15 min</option>
        </select>
        <div aria-label="Affichage du planning" className="ml-auto flex gap-1 rounded-lg border bg-card p-0.5">
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" aria-label="Vue planning" aria-pressed={view === "grid"} onClick={() => setView("grid")} className="h-11 w-11"><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" aria-label="Vue liste" aria-pressed={view === "list"} onClick={() => setView("list")} className="h-11 w-11"><List className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="border-t px-3 py-2 sm:px-5"><AppointmentPaymentLegend /></div>

      {view === "grid" && <div ref={teamScroll} className="overflow-x-hidden"><div data-agenda-team className="grid min-w-[var(--agenda-min-width)] border-t bg-card" style={{ gridTemplateColumns: columns }}>
        <div className="sticky left-0 z-20 flex items-center justify-center self-stretch bg-card text-[10px] font-medium text-muted-foreground">Heure</div>
        {visibleStaff.map(member => <div key={member.id} className="flex min-h-14 min-w-0 items-center gap-1 border-l px-1 py-2 sm:px-2">
          <div className="min-w-0"><p className="truncate text-[10px] font-semibold sm:text-sm">{getStaffDisplayName(member)}</p><p className="text-[10px] text-muted-foreground">{byStaff.get(member.id)?.filter(appointment => isBookedAppointment(appointment.status)).length || 0} prestations</p></div>
        </div>)}
      </div></div>}
    </div>

    {loading && <p role="status" className="border-b bg-muted/30 px-4 py-2 text-sm text-muted-foreground">Actualisation du planning…</p>}
    {!displayHours.length || !staff.length ? <div className="p-10 text-center text-sm text-muted-foreground">{loading ? "Chargement du planning…" : !staff.length ? "Aucune masseuse disponible pour ce salon." : "Salon fermé ce jour."}</div> : view === "grid" ? (
      <>
      {visibleStaff.length > 2 && <p className="border-b px-3 py-1 text-[11px] text-muted-foreground sm:hidden">Glissez le planning pour voir toute l’équipe →</p>}
      <div data-agenda-scroll className="overflow-x-auto overscroll-x-contain" onScroll={event => { if (teamScroll.current) teamScroll.current.scrollLeft = event.currentTarget.scrollLeft }}>
      <div data-agenda-grid className="grid min-w-[var(--agenda-min-width)] bg-card" style={{ gridTemplateColumns: columns }} aria-busy={loading}>
        <div className="sticky left-0 z-20 bg-card">
          {displayHours.map(hour => <div key={hour} className="border-b px-1 pt-2 text-right text-xs font-medium tabular-nums text-muted-foreground" style={{ height: hourHeight }}>
            <CalendarHourLabel hour={hour} date={date} openingHours={openingHours} />
          </div>)}
        </div>
        {visibleStaff.map(member => <div key={member.id} data-agenda-column={member.id} className="relative min-w-0 border-l">
          {displayHours.map(hour => <div key={hour} className="relative border-b" style={{ height: hourHeight }}>
            <CalendarClosedHours hour={hour} date={date} openingHours={openingHours} />
            <div className="grid h-full" style={{ gridTemplateRows: `repeat(${60 / interval}, minmax(0, 1fr))` }}>
              {Array.from({ length: 60 / interval }, (_, index) => {
                const minute = index * interval
                const open = isCalendarQuarterOpen(hour, minute, date, openingHours) && (interval === 15 || isCalendarQuarterOpen(hour, minute + 15, date, openingHours))
                const destination = { date, hour, minute, staffId: member.id }
                return <AgendaSlot key={minute} id={`tablet-${member.id}-${hour}-${minute}`} destination={destination}
                  closed={!open} invalid={Boolean(movingAppointment && isInvalidDestination?.(destination))}
                  allowClosedDrop={moveModePolicy === "salon-admin"}
                  dragging={Boolean(movingAppointment)} disabled={Boolean(loading)}
                  height={hourHeight / (60 / interval)}
                  label={`Nouveau rendez-vous à ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} avec ${getStaffDisplayName(member)}`}
                  onCreate={() => onEmptySlotClick(destination)} />
              })}
            </div>
          </div>)}
          {(byStaff.get(member.id) || []).map(appointment => {
            const startHour = Number(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"))
            const minute = Number(formatInTimeZone(appointment.start_time, "Europe/Paris", "m"))
            const bookedMinutes = getAppointmentDurationMinutes(appointment)
            // While the grip is held, the card follows the pointer before anything is saved.
            const previewMinutes = resizing?.id === appointment.id
              ? Math.max(15, bookedMinutes + resizing.delta) : bookedMinutes
            const height = Math.max(22, previewMinutes / 60 * hourHeight - 2)
            const released = isReleasedAppointment(appointment.status)
            const box = getLaneBox(lanesByStaff.get(member.id)?.get(appointment.id), 4)
            const padding = appointment.status === "blocked" ? "p-0.5 sm:p-2" : height < 44 ? "p-0" : "p-0.5 sm:p-1"
            const commitResize = (delta: number) => {
              setResizing(null)
              const minutes = Math.max(15, bookedMinutes + delta)
              if (!onResize || minutes === bookedMinutes) return
              onResize(appointment, new Date(Date.parse(appointment.start_time) + minutes * 60_000).toISOString())
            }
            // Held down then dragged, a booking moves; a plain tap still opens it.
            if (canMoveAppointment(appointment, moveModePolicy)) return <DraggableAppointment key={appointment.id} id={appointment.id} appointment={appointment}
              onClick={() => onAppointmentClick(appointment)}
              className={`absolute z-10 select-none overflow-hidden rounded-lg border border-l-[3px] text-left ${padding} ring-1 ring-primary/50 ${getAppointmentColor(appointment)}`}
              style={{ top: (startHour - displayHours[0] + minute / 60) * hourHeight + 1, height, ...box, touchAction: "none", WebkitTouchCallout: "none" }}>
              <div className="pointer-events-none"><AppointmentCardContent appointment={appointment} height={height} /></div>
              {onResize && <ResizeHandle pxPerMinute={hourHeight / 60}
                onPreview={delta => setResizing({ id: appointment.id, delta })}
                onCommit={commitResize} />}
            </DraggableAppointment>
            return <button key={appointment.id} type="button" data-appointment-id={appointment.id}
              onClick={() => onAppointmentClick(appointment)}
              className={`absolute overflow-hidden rounded-lg border border-l-[3px] text-left ${padding} focus-visible:outline-2 focus-visible:outline-ring ${released ? `z-[5] ${RELEASED_CARD_CLASS}` : "z-10"} ${getAppointmentColor(appointment)}`}
              style={{ top: (startHour - displayHours[0] + minute / 60) * hourHeight + 1, height, ...box }}>
              <AppointmentCardContent appointment={appointment} height={height} />
            </button>
          })}
        </div>)}
      </div>
      </div>
      </>
    ) : <div className="space-y-2 p-3 sm:p-5">
      {dayAppointments.filter(appointment => !activeMember || getAppointmentStaffIds(appointment).includes(activeMember.id)).map(appointment => <button key={appointment.id} type="button"
        onClick={() => onAppointmentClick(appointment)} className={`flex min-h-24 w-full items-start gap-4 rounded-xl border p-4 text-left ${isReleasedAppointment(appointment.status) ? "border-dashed opacity-60" : ""} ${getAppointmentColor(appointment)}`}>
        <div className="min-w-0 flex-1"><AppointmentCardContent appointment={appointment} height={160} /></div>
      </button>)}
      {!dayAppointments.length && <p className="p-8 text-center text-sm text-muted-foreground">Aucun rendez-vous ce jour.</p>}
    </div>}

    <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
      <DialogContent className="max-w-[370px] p-3 sm:max-w-[370px] sm:p-3">
        <DialogHeader className="px-1 py-2"><DialogTitle>Choisir une date</DialogTitle><DialogDescription>Afficher le planning de cette journée.</DialogDescription></DialogHeader>
        <Calendar locale={fr} mode="single" required selected={date} defaultMonth={date} onSelect={next => { changeDate(next); setCalendarOpen(false) }} className="mx-auto w-full max-w-[344px] rounded-lg" />
      </DialogContent>
    </Dialog>
    <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Résumé du jour</DialogTitle><DialogDescription>{format(date, "EEEE d MMMM yyyy", { locale: fr })}</DialogDescription></DialogHeader>
        {summary}
        <AppointmentServiceColorKey appointments={dayAppointments} />
        {onBlock && <Button variant="outline" onClick={() => { setSummaryOpen(false); onBlock() }}><Ban className="mr-2 h-4 w-4" />Bloquer un créneau</Button>}
      </DialogContent>
    </Dialog>
  </section>
})
