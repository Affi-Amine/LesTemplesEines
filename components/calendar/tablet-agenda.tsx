"use client"

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { addDays, format } from "date-fns"
import { fr } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, List, LayoutGrid, SlidersHorizontal, Ban, Move } from "lucide-react"
import { useDndMonitor, useDroppable } from "@dnd-kit/core"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AppointmentCardContent } from "@/components/calendar/appointment-card-content"
import { CalendarClosedHours, CalendarHourLabel, isCalendarQuarterOpen } from "@/components/calendar/closed-hours"
import { getAppointmentDurationMinutes, getAppointmentStaffIds, getStaffDisplayName, type SalonOpeningHours } from "@/lib/calendar/scheduling"
import { getAppointmentColor } from "@/lib/utils"
import { DraggableAppointment } from "@/components/calendar/draggable-appointment"
import { canMoveAppointment, type MoveDestination } from "@/lib/calendar/appointment-move"

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
}

function MoveTarget({ id, destination, invalid, closed, height }: {
  id: string; destination: MoveDestination; invalid: boolean; closed: boolean; height: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: destination })
  return <div ref={setNodeRef} data-calendar-slot={id} data-drop-over={isOver} data-drop-invalid={invalid || closed}
    className={`w-full border-b border-dashed border-border/60 last:border-b-0 ${isOver ? invalid || closed ? "bg-destructive/20 ring-2 ring-inset ring-destructive" : "bg-primary/20 ring-2 ring-inset ring-primary" : invalid || closed ? "bg-destructive/5" : ""}`}
    style={{ height }} />
}

// In normal use all cells are native buttons. Drag registrations exist only in move mode.
export const TabletAgenda = memo(function TabletAgenda({
  salonName, date, onDateChange, staff, appointments, hours, openingHours, loading,
  onAppointmentClick, onEmptySlotClick, onCreate, onBlock, summary, salonControl, salonTitleControl, movingAppointment, isInvalidDestination,
}: TabletAgendaProps) {
  const root = useRef<HTMLElement>(null)
  const [memberId, setMemberId] = useState("all")
  const [interval, setInterval] = useState<15 | 30>(30)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [moveMode, setMoveMode] = useState(false)
  const dayKey = formatInTimeZone(date, "Europe/Paris", "yyyy-MM-dd")
  const hourHeight = interval === 30 ? 96 : 180
  useEffect(() => { setMoveMode(false) }, [dayKey, salonName, view])
  useDndMonitor({ onDragEnd: () => setMoveMode(false), onDragCancel: () => setMoveMode(false) })

  const activeMember = staff.find(member => member.id === memberId)
  const visibleStaff = activeMember ? [activeMember] : staff
  const dayAppointments = useMemo(() => appointments.filter(appointment =>
    !["cancelled", "no_show"].includes(appointment.status) &&
    formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd") === dayKey
  ).sort((a, b) => a.start_time.localeCompare(b.start_time)), [appointments, dayKey])
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
  const columns = `40px repeat(${Math.max(visibleStaff.length, 1)}, minmax(0, 1fr))`
  const changeDate = (next: Date) => onDateChange(next)
  const selectClass = "h-11 min-w-0 rounded-lg border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return <section ref={root} data-tablet-agenda data-move-mode={moveMode} onKeyDown={event => { if (event.key === "Escape") setMoveMode(false) }} aria-label={`Agenda de ${salonName}`} className="min-w-0 bg-background">
    <div data-agenda-toolbar className="sticky top-16 z-30 border-b bg-card">
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Les Temples · Agenda</p>
          <h1 className="truncate text-lg font-semibold tracking-tight">{salonTitleControl || salonName}</h1>
        </div>
        <Button variant="ghost" onClick={() => setSummaryOpen(true)} aria-label="Résumé et repères du planning" className="h-11 shrink-0 gap-2 px-3">
          <span className="hidden text-sm sm:inline">{dayAppointments.length} rendez-vous</span><SlidersHorizontal className="h-5 w-5" />
        </Button>
      </div>

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
          {view === "grid" && <Button variant={moveMode ? "secondary" : "outline"} aria-label="Mode déplacement" aria-pressed={moveMode} onClick={() => setMoveMode(value => !value)} className="h-11 gap-2 px-3"><Move className="h-4 w-4" /><span className="hidden min-[600px]:inline">Déplacer</span></Button>}
          <Button onClick={onCreate} disabled={moveMode} className="h-11 gap-2 rounded-lg px-3 sm:px-4"><Plus className="h-5 w-5" /><span className="hidden min-[420px]:inline">Rendez-vous</span><span className="min-[420px]:hidden">RDV</span></Button>
        </div>
      </div>

      {moveMode && <div role="status" className="flex items-center justify-between gap-3 border-t bg-primary/5 px-3 py-1 text-xs sm:px-5">
        <p>{movingAppointment ? "Déposez le rendez-vous sur le nouvel horaire. Les zones rouges sont indisponibles." : "Maintenez un rendez-vous, puis glissez-le sur le nouvel horaire. Vous confirmerez ensuite."}</p>
        <Button variant="ghost" onClick={() => setMoveMode(false)} className="h-11 shrink-0">Annuler</Button>
      </div>}

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2 sm:px-5">
        {salonControl}
        <select aria-label="Afficher une masseuse" value={activeMember ? memberId : "all"} onChange={event => setMemberId(event.target.value)} className={`${selectClass} max-w-[170px] flex-1`}>
          <option value="all">Toute l’équipe</option>
          {staff.map(member => <option key={member.id} value={member.id}>{getStaffDisplayName(member)}</option>)}
        </select>
        <select aria-label="Précision du planning" value={interval} onChange={event => setInterval(Number(event.target.value) as 15 | 30)} className={selectClass}>
          <option value={30}>30 min</option><option value={15}>15 min</option>
        </select>
        <div aria-label="Affichage du planning" className="ml-auto flex gap-1 rounded-lg border bg-card p-0.5">
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" aria-label="Vue planning" aria-pressed={view === "grid"} onClick={() => setView("grid")} className="h-11 w-11"><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" aria-label="Vue liste" aria-pressed={view === "list"} onClick={() => setView("list")} className="h-11 w-11"><List className="h-4 w-4" /></Button>
        </div>
      </div>

      {view === "grid" && <div data-agenda-team className="grid border-t bg-card" style={{ gridTemplateColumns: columns }}>
        <div className="self-center text-center text-[10px] font-medium text-muted-foreground">Heure</div>
        {visibleStaff.map(member => <div key={member.id} className="flex min-h-14 min-w-0 items-center gap-1 border-l px-1 py-2 sm:px-2">
          <div className="min-w-0"><p className="truncate text-[10px] font-semibold sm:text-sm">{getStaffDisplayName(member)}</p><p className="text-[10px] text-muted-foreground">{byStaff.get(member.id)?.length || 0} rendez-vous</p></div>
        </div>)}
      </div>}
    </div>

    {loading && <p role="status" className="border-b bg-muted/30 px-4 py-2 text-sm text-muted-foreground">Actualisation du planning…</p>}
    {!hours.length || !staff.length ? <div className="p-10 text-center text-sm text-muted-foreground">{loading ? "Chargement du planning…" : !staff.length ? "Aucune masseuse disponible pour ce salon." : "Salon fermé ce jour."}</div> : view === "grid" ? (
      <div data-agenda-grid className="grid bg-card" style={{ gridTemplateColumns: columns }} aria-busy={loading}>
        <div className="bg-muted/30">
          {hours.map(hour => <div key={hour} className="border-b px-1 pt-2 text-right text-xs font-medium tabular-nums text-muted-foreground" style={{ height: hourHeight }}>
            <CalendarHourLabel hour={hour} date={date} openingHours={openingHours} />
          </div>)}
        </div>
        {visibleStaff.map(member => <div key={member.id} data-agenda-column={member.id} className="relative min-w-0 border-l">
          {hours.map(hour => <div key={hour} className="relative border-b" style={{ height: hourHeight }}>
            <CalendarClosedHours hour={hour} date={date} openingHours={openingHours} />
            <div className="grid h-full" style={{ gridTemplateRows: `repeat(${60 / interval}, minmax(0, 1fr))` }}>
              {Array.from({ length: 60 / interval }, (_, index) => {
                const minute = index * interval
                const open = isCalendarQuarterOpen(hour, minute, date, openingHours) && (interval === 15 || isCalendarQuarterOpen(hour, minute + 15, date, openingHours))
                if (moveMode) return <MoveTarget key={minute} id={`tablet-${member.id}-${hour}-${minute}`} destination={{ date, hour, minute, staffId: member.id }}
                  closed={!open} invalid={Boolean(isInvalidDestination?.({ date, hour, minute, staffId: member.id }))} height={hourHeight / (60 / interval)} />
                return <button key={minute} type="button" data-calendar-slot={`${member.id}-${hour}-${minute}`} disabled={!open || loading}
                  aria-label={`Nouveau rendez-vous à ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} avec ${getStaffDisplayName(member)}`}
                  onClick={() => onEmptySlotClick({ date, hour, minute, staffId: member.id })}
                  className="min-h-0 w-full border-b border-dashed border-border/60 bg-transparent text-left last:border-b-0 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default enabled:active:bg-primary/10" />
              })}
            </div>
          </div>)}
          {(byStaff.get(member.id) || []).map(appointment => {
            const startHour = Number(formatInTimeZone(appointment.start_time, "Europe/Paris", "H"))
            const minute = Number(formatInTimeZone(appointment.start_time, "Europe/Paris", "m"))
            const height = Math.max(22, getAppointmentDurationMinutes(appointment) / 60 * hourHeight - 2)
            if (moveMode && canMoveAppointment(appointment)) return <DraggableAppointment key={appointment.id} id={appointment.id} appointment={appointment}
              className={`absolute inset-x-1 z-10 select-none overflow-hidden rounded-lg border border-l-[3px] p-0.5 text-left sm:p-2 ring-1 ring-primary/50 ${getAppointmentColor(appointment)}`}
              style={{ top: (startHour - hours[0] + minute / 60) * hourHeight + 1, height, touchAction: "none", WebkitTouchCallout: "none" }}>
              <div className="pointer-events-none"><AppointmentCardContent appointment={appointment} height={height} /></div>
            </DraggableAppointment>
            return <button key={appointment.id} type="button" data-appointment-id={appointment.id}
              disabled={moveMode || appointment.status === "blocked"} onClick={() => onAppointmentClick(appointment)}
              className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border border-l-[3px] p-0.5 text-left sm:p-2 focus-visible:outline-2 focus-visible:outline-ring ${getAppointmentColor(appointment)}`}
              style={{ top: (startHour - hours[0] + minute / 60) * hourHeight + 1, height }}>
              <AppointmentCardContent appointment={appointment} height={height} />
            </button>
          })}
        </div>)}
      </div>
    ) : <div className="space-y-2 p-3 sm:p-5">
      {dayAppointments.filter(appointment => !activeMember || getAppointmentStaffIds(appointment).includes(activeMember.id)).map(appointment => <button key={appointment.id} type="button" disabled={appointment.status === "blocked"}
        onClick={() => onAppointmentClick(appointment)} className={`flex min-h-24 w-full items-start gap-4 rounded-xl border p-4 text-left ${getAppointmentColor(appointment)}`}>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")}</span>
        <AppointmentCardContent appointment={appointment} height={96} />
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
      <DialogContent><DialogHeader><DialogTitle>Résumé du jour</DialogTitle><DialogDescription>{format(date, "EEEE d MMMM yyyy", { locale: fr })}</DialogDescription></DialogHeader>
        {summary}
        {onBlock && <Button variant="outline" onClick={() => { setSummaryOpen(false); onBlock() }}><Ban className="mr-2 h-4 w-4" />Bloquer un créneau</Button>}
      </DialogContent>
    </Dialog>
  </section>
})
