"use client"

import { CalendarDays, Check, Clock3, RefreshCw, Users } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getStaffDisplayName } from "@/lib/calendar/scheduling"
import { isScheduleDate } from "@/lib/calendar/working-periods"
import type { AppointmentSchedule } from "@/lib/hooks/use-appointment-schedule"

const timeLabel = (instant: string) => formatInTimeZone(instant, "Europe/Paris", "HH:mm")
const periods = [{ title: "Matin", from: 0, to: 12 }, { title: "Après-midi", from: 12, to: 18 }, { title: "Soir", from: 18, to: 24 }]

export function AppointmentSchedulePicker({ schedule, onDateChange, disabled = false }: {
  schedule: AppointmentSchedule
  onDateChange: (date: string) => void
  disabled?: boolean
}) {
  const { context, slot, slots, staff, staffIds, isLoading, hasError, notice } = schedule
  const ready = Boolean(context.serviceId && context.date)
  const unavailable = disabled || isLoading || hasError
  const availableStaff = staff.filter(member => slot?.available_staff.includes(member.id))
  const nextDay = () => {
    if (!isScheduleDate(context.date)) return
    const date = new Date(`${context.date}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + 1)
    onDateChange(date.toISOString().slice(0,10))
  }

  return (
    <div className="space-y-5">
      <section aria-label="Jour et créneau" className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" />2. Jour et créneau</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Les horaires proposés tiennent compte du soin et de toute l’équipe disponible.</p>
          </div>
          {ready && <span className="shrink-0 rounded-full border px-2 py-1 text-xs tabular-nums">{context.durationMinutes} min</span>}
        </div>
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="appointment-schedule-date">Jour du rendez-vous</Label>
          <Input id="appointment-schedule-date" type="date" value={context.date}
            min={formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd")}
            disabled={disabled} onChange={event => {
              if (!event.target.value || isScheduleDate(event.target.value)) onDateChange(event.target.value)
            }} />
        </div>

        <div className="flex items-center justify-between gap-3">
        <div role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {!context.serviceId ? "Choisissez d’abord le soin pour voir les créneaux." : !context.date ? "Choisissez un jour pour voir les créneaux disponibles." :
            isLoading ? "Actualisation des disponibilités…" : hasError ? "Les disponibilités n’ont pas pu être vérifiées." :
            `${slots.length} créneau${slots.length > 1 ? "x" : ""} avec ${context.requiredStaff} masseuse${context.requiredStaff > 1 ? "s" : ""} disponible${context.requiredStaff > 1 ? "s" : ""}.`}
        </div>
        {ready && <Button type="button" variant="ghost" size="sm" disabled={disabled || isLoading} onClick={() => void schedule.refresh()}>
          <RefreshCw className={`mr-1.5 h-3 w-3 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`} />Actualiser
        </Button>}
        </div>
        {notice && <p role="status" className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950">{notice}</p>}
        {ready && hasError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm">
            <p>Impossible de charger les créneaux. Vos informations sont conservées.</p>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void schedule.refresh()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />Réessayer
            </Button>
          </div>
        ) : ready && !isLoading && !slots.length ? (
          <div className="space-y-3 rounded-lg border border-dashed p-4">
            <p className="text-sm font-medium">Aucun créneau disponible ce jour.</p>
            <p className="text-xs leading-5 text-muted-foreground">Essayez un autre jour ou un autre soin. Vous n’avez pas besoin de consulter les plannings séparément.</p>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={nextDay}>Voir le lendemain</Button>
          </div>
        ) : ready ? (
          <div aria-label="Créneaux disponibles" aria-busy={isLoading} className="max-h-72 space-y-4 overflow-y-auto overscroll-contain pr-1">
            {periods.map(period => {
              const periodSlots = slots.filter(item => {
                const hour = Number(formatInTimeZone(item.start, "Europe/Paris", "H"))
                return hour >= period.from && hour < period.to
              })
              if (!periodSlots.length) return null
              return <div key={period.title} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{period.title}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {periodSlots.map(item => {
                    const selected = slot?.start === item.start
                    const count = item.available_staff.length
                    return <button key={item.start} type="button" disabled={unavailable}
                      aria-label={`${timeLabel(item.start)}, ${count} masseuse${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}`}
                      aria-pressed={selected} onClick={() => schedule.chooseSlot(item.start)}
                      className={`min-h-14 rounded-lg border px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/60 hover:bg-primary/5"}`}>
                      <span className="block text-sm font-semibold tabular-nums">{timeLabel(item.start)}</span>
                      <span className={`mt-0.5 block text-[10px] ${selected ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{count} disponible{count > 1 ? "s" : ""}</span>
                    </button>
                  })}
                </div>
              </div>
            })}
          </div>
        ) : null}
      </section>

      <section aria-label="Équipe du rendez-vous" className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />3. Masseuses disponibles</h3>
          {slot && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{staffIds.length}/{context.requiredStaff} sélectionnée{staffIds.length > 1 ? "s" : ""}</span>}
        </div>
        {!slot || hasError ? <p className="text-xs leading-5 text-muted-foreground">Choisissez un créneau pour voir uniquement les masseuses libres pendant toute la durée du soin.</p> : <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{timeLabel(slot.start)}–{timeLabel(slot.end)} · {context.requiredStaff === 1 ? "Choisissez une masseuse." : `Choisissez ${context.requiredStaff} masseuses.`}</p>
            <Button type="button" variant="ghost" size="sm" disabled={unavailable} onClick={schedule.assignAutomatically}>Choisir pour moi</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableStaff.map(member => {
              const selected = staffIds.includes(member.id)
              const full = context.requiredStaff > 1 && staffIds.length >= context.requiredStaff && !selected
              return <button key={member.id} type="button" aria-pressed={selected}
                disabled={unavailable || full} onClick={() => schedule.toggleStaff(member.id)}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${selected ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/30"}`}>
                <span><span className="block text-sm font-medium">{getStaffDisplayName(member)}</span><span className="mt-0.5 block text-xs text-muted-foreground">Disponible sur tout le créneau</span></span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
              </button>
            })}
          </div>
          {context.requiredStaff > 1 && staffIds.length < context.requiredStaff && <p className="text-xs text-muted-foreground">Encore {context.requiredStaff - staffIds.length} masseuse{context.requiredStaff - staffIds.length > 1 ? "s" : ""} à choisir pour compléter l’équipe.</p>}
        </>}
      </section>
    </div>
  )
}
