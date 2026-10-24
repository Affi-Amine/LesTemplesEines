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
export interface SlotSelection { context: string; start: string; staffIds: string[] }
export interface ScheduleContext {
  salonId: string
  serviceId: string
  serviceIds?: string[]
  date: string
  requiredStaff: number
  durationMinutes: number
}

export const EMPTY_SLOT_SELECTION: SlotSelection = { context: "", start: "", staffIds: [] }
const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
export function scheduleContextKey(context: ScheduleContext) {
  return JSON.stringify([context.salonId, context.serviceId, context.date, context.requiredStaff, context.durationMinutes, context.serviceIds || []])
}

export function getSelectableSlots(context: ScheduleContext, slots: AvailabilitySlot[], staff: ScheduleStaff[], now = Date.now()) {
  const eligible = new Set(staff.filter(member => member.salon_id === context.salonId &&
    canStaffTakeBookings(member) && (context.serviceIds?.length ? context.serviceIds : [context.serviceId]).every(id => canProvideService(member.allowed_service_ids, id))).map(member => member.id))
  if (!context.serviceId || !Number.isInteger(context.requiredStaff) || context.requiredStaff < 1 || context.durationMinutes <= 0) return []
  return slots.flatMap(slot => {
    const start = Date.parse(slot.start), end = Date.parse(slot.end)
    const available_staff = Array.from(new Set(slot.available_staff || [])).filter(id => eligible.has(id))
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < now ||
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
  if (selection.context !== key) return { context: key, start: "", staffIds: [] }
  const slot = slots.find(slot => slot.start === selection.start)
  if (!slot) return { context: key, start: "", staffIds: [] }
  return { context: key, start: slot.start, staffIds: Array.from(new Set(selection.staffIds))
    .filter(id => slot.available_staff?.includes(id)).slice(0, context.requiredStaff) }
}

export function chooseScheduleSlot(context: ScheduleContext, selection: SlotSelection, slot: AvailabilitySlot, preferredStaffId?: string): SlotSelection {
  const available = Array.from(new Set(slot.available_staff || []))
  const retained = selection.context === scheduleContextKey(context) ? selection.staffIds.filter(id => available.includes(id)) : []
  const staffIds = available.length === context.requiredStaff ? available : retained.length ? retained :
    preferredStaffId && available.includes(preferredStaffId) ? [preferredStaffId] : []
  return { context: scheduleContextKey(context), start: slot.start, staffIds: staffIds.slice(0, context.requiredStaff) }
}
