import type { AvailabilitySlot } from "@/lib/hooks/use-availability"
import { canProvideService } from "@/lib/appointments/rules"
import { canStaffTakeBookings } from "@/lib/calendar/scheduling"

export interface ScheduleStaff {
  id: string
  salon_id: string
  first_name: string
  last_name: string
  is_active: boolean
  role: string
  allowed_service_ids?: string[]
}
export interface SlotSelection { context: string; start: string; staffIds: string[]; requestedStaffIds?: string[] }
export interface ScheduleContext {
  salonId: string
  serviceId: string
  serviceIds?: string[]
  date: string
  requiredStaff: number
  durationMinutes: number
  /** Admin agendas: keep today's already-passed slots selectable (walk-ins recorded late). */
  includePast?: boolean
}

export const EMPTY_SLOT_SELECTION: SlotSelection = { context: "", start: "", staffIds: [], requestedStaffIds: [] }
const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
export function scheduleContextKey(context: ScheduleContext) {
  return JSON.stringify([context.salonId, context.serviceId, context.date, context.requiredStaff, context.durationMinutes, context.serviceIds || [], context.includePast || false])
}

export function getSelectableSlots(context: ScheduleContext, slots: AvailabilitySlot[], staff: ScheduleStaff[], now = Date.now()) {
  const eligible = new Set(staff.filter(member => member.salon_id === context.salonId &&
    canStaffTakeBookings(member) && (context.serviceIds?.length ? context.serviceIds : [context.serviceId]).every(id => canProvideService(member.allowed_service_ids, id))).map(member => member.id))
  if (!context.serviceId || !Number.isInteger(context.requiredStaff) || context.requiredStaff < 1 || context.durationMinutes <= 0) return []
  return slots.flatMap(slot => {
    const start = Date.parse(slot.start), end = Date.parse(slot.end)
    const available_staff = Array.from(new Set(slot.available_staff || [])).filter(id => eligible.has(id))
    if (!Number.isFinite(start) || !Number.isFinite(end) || (!context.includePast && start < now) ||
        end - start !== context.durationMinutes * 60_000 || available_staff.length < context.requiredStaff) return []
    // Check the Paris calendar date rather than the UTC date of the instant.
    const parts = parisDate.formatToParts(start)
    const part = (type: string) => parts.find(item => item.type === type)?.value
    if (`${part("year")}-${part("month")}-${part("day")}` !== context.date) return []
    return [{ ...slot, available_staff }]
  }).filter((slot, index, all) => all.findIndex(other => Date.parse(other.start) === Date.parse(slot.start)) === index)
    .sort((a,b) => Date.parse(a.start) - Date.parse(b.start))
}

export function reconcileSlotSelection(context: ScheduleContext, selection: SlotSelection, slots: AvailabilitySlot[]): SlotSelection {
  const key = scheduleContextKey(context)
  if (selection.context !== key) return { context: key, start: "", staffIds: [], requestedStaffIds: [] }
  const slot = slots.find(slot => slot.start === selection.start)
  if (!slot) return { context: key, start: "", staffIds: [], requestedStaffIds: [] }
  const staffIds = Array.from(new Set(selection.staffIds)).filter(id => slot.available_staff?.includes(id)).slice(0, context.requiredStaff)
  return { context: key, start: slot.start, staffIds,
    requestedStaffIds: Array.from(new Set(selection.requestedStaffIds || [])).filter(id => staffIds.includes(id)) }
}

export function chooseScheduleSlot(context: ScheduleContext, selection: SlotSelection, slot: AvailabilitySlot, preferredStaffId?: string): SlotSelection {
  const available = Array.from(new Set(slot.available_staff || []))
  const retained = selection.context === scheduleContextKey(context) ? selection.staffIds.filter(id => available.includes(id)) : []
  const staffIds = available.length === context.requiredStaff ? available : retained.length ? retained :
    preferredStaffId && available.includes(preferredStaffId) ? [preferredStaffId] : []
  const selected = staffIds.slice(0, context.requiredStaff)
  return { context: scheduleContextKey(context), start: slot.start, staffIds: selected,
    requestedStaffIds: selection.context === scheduleContextKey(context) ? (selection.requestedStaffIds || []).filter(id => selected.includes(id)) : [] }
}

/** Only a deliberate click establishes a preference; automatic preselection does not. */
export function toggleScheduleStaff(context: ScheduleContext, selection: SlotSelection, slot: AvailabilitySlot, id: string): SlotSelection {
  if (!slot.available_staff?.includes(id)) return selection
  const selected = selection.staffIds.includes(id)
  const requested = selection.requestedStaffIds || []
  if (selected && !requested.includes(id)) return { ...selection, requestedStaffIds: [...requested, id] }
  if (!selected && selection.staffIds.length >= context.requiredStaff) {
    return context.requiredStaff === 1 ? { ...selection, staffIds: [id], requestedStaffIds: [id] } : selection
  }
  return { ...selection, staffIds: selected ? selection.staffIds.filter(item => item !== id) : [...selection.staffIds, id],
    requestedStaffIds: selected ? requested.filter(item => item !== id) : [...requested, id] }
}

export function assignScheduleStaffAutomatically(context: ScheduleContext, selection: SlotSelection, slot: AvailabilitySlot): SlotSelection {
  return { ...selection, staffIds: (slot.available_staff || []).slice(0, context.requiredStaff), requestedStaffIds: [] }
}
