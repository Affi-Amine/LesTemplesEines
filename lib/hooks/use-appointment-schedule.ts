"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAvailability } from "@/lib/hooks/use-availability"
import { useStaff } from "@/lib/hooks/use-staff"
import { chooseScheduleSlot, EMPTY_SLOT_SELECTION, getSelectableSlots, reconcileSlotSelection, scheduleContextKey, type ScheduleContext, type SlotSelection } from "@/lib/calendar/slot-selection"

export function useAppointmentSchedule(context: ScheduleContext, enabled = true, preferredStaffId?: string) {
  const { salonId, serviceId, date, requiredStaff, durationMinutes } = context
  const serviceIdsKey = JSON.stringify(context.serviceIds || [])
  const key = scheduleContextKey(context)
  const stableContext = useMemo(() => ({ salonId, serviceId, date, requiredStaff, durationMinutes, serviceIds: JSON.parse(serviceIdsKey) as string[] }), [salonId, serviceId, date, requiredStaff, durationMinutes, serviceIdsKey])
  const staffQuery = useStaff(salonId)
  const query = useAvailability(undefined, date, serviceId, salonId, { enabled, version: `${requiredStaff}:${durationMinutes}`, serviceIds: stableContext.serviceIds })
  const [selection, setSelection] = useState<SlotSelection>(EMPTY_SLOT_SELECTION)
  const [notice, setNotice] = useState("")
  const staff = staffQuery.data || []
  const slots = useMemo(() => getSelectableSlots(stableContext, query.data?.available_slots || [], staffQuery.data || []),
    [stableContext, query.data, staffQuery.data])
  const current = reconcileSlotSelection(stableContext, selection, slots)
  const slot = slots.find(item => item.start === current.start)
  const hasError = query.isError || staffQuery.isError
  const isLoading = query.isFetching || staffQuery.isFetching || staffQuery.isPending
  const isValid = enabled && !hasError && !isLoading && Boolean(slot) && current.staffIds.length === requiredStaff
  const latest = useRef({ key, selection, staff })
  latest.current = { key, selection, staff }

  useEffect(() => {
    if (selection.context !== key) {
      setSelection({ context: key, start: "", staffIds: [] })
      setNotice("")
      return
    }
    if (!query.isSuccess || query.isFetching || staffQuery.isPending || hasError) return
    const available = getSelectableSlots(stableContext, query.data.available_slots, staffQuery.data || [])
    const next = reconcileSlotSelection(stableContext, selection, available)
    if (next.start !== selection.start || next.staffIds.join() !== selection.staffIds.join()) {
      setSelection(next)
      if (selection.start) setNotice(next.start
        ? "La disponibilité de l'équipe a changé. Choisissez les masseuses encore libres."
        : "Ce créneau n'est plus disponible. Choisissez-en un autre ; les informations client sont conservées.")
    }
  }, [key, stableContext, selection, query.isSuccess, query.isFetching, query.data, staffQuery.isPending, staffQuery.data, hasError])

  const chooseSlot = (start: string) => {
    const next = slots.find(slot => slot.start === start)
    if (!next || isLoading || hasError) return
    setSelection(chooseScheduleSlot(stableContext, current, next, preferredStaffId))
    setNotice("")
  }
  const toggleStaff = (id: string) => {
    if (!slot?.available_staff?.includes(id) || isLoading || hasError) return
    setSelection(previous => {
      const current = reconcileSlotSelection(stableContext, previous, slots)
      const selected = current.staffIds.includes(id)
      if (!selected && current.staffIds.length >= requiredStaff) {
        return requiredStaff === 1 ? { ...current, staffIds: [id] } : current
      }
      return { ...current, staffIds: selected ? current.staffIds.filter(item => item !== id) : [...current.staffIds, id] }
    })
  }
  const assignAutomatically = () => {
    if (slot && !isLoading && !hasError) setSelection({ ...current, staffIds: slot.available_staff.slice(0, requiredStaff) })
  }
  const refreshSelection = async () => {
    const snapshot = latest.current
    if (!isValid) return null
    const [result, refreshedStaff] = await Promise.all([
      query.refetch({ throwOnError: true }), staffQuery.refetch({ throwOnError: true }),
    ])
    if (latest.current.key !== snapshot.key || latest.current.selection.start !== snapshot.selection.start ||
        latest.current.selection.staffIds.join() !== snapshot.selection.staffIds.join()) return null
    if ((result.data?.required_staff !== undefined && result.data.required_staff !== requiredStaff) ||
        (result.data?.service_duration_minutes !== undefined && result.data.service_duration_minutes !== durationMinutes)) {
      setSelection({ context: key, start: "", staffIds: [] })
      setNotice("Le soin a été modifié. Ses disponibilités vont être actualisées ; choisissez un nouveau créneau.")
      return null
    }
    const refreshedSlots = getSelectableSlots(stableContext, result.data?.available_slots || [], refreshedStaff.data || [])
    const next = reconcileSlotSelection(stableContext, snapshot.selection, refreshedSlots)
    const refreshedSlot = refreshedSlots.find(slot => slot.start === next.start)
    if (!refreshedSlot || next.staffIds.length !== requiredStaff) {
      setSelection(next)
      setNotice("Ce choix vient de changer. Sélectionnez un créneau et son équipe parmi les disponibilités actualisées.")
      return null
    }
    return { slot: refreshedSlot, staffIds: next.staffIds }
  }
  const refresh = () => Promise.all([query.refetch(), staffQuery.refetch()])
  const clear = (message = "") => { setSelection({ context: key, start: "", staffIds: [] }); setNotice(message) }
  return { context: stableContext, slots, slot, staff, staffIds: current.staffIds, isValid, isLoading, hasError, notice,
    chooseSlot, toggleStaff, assignAutomatically, refreshSelection, refresh, clear }
}

export type AppointmentSchedule = ReturnType<typeof useAppointmentSchedule>
