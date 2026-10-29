"use client"

import { useRef, useState } from "react"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { toast } from "sonner"
import { formatInTimeZone } from "date-fns-tz"
import { appointmentMoveVersion, canMoveAppointment, planAppointmentMove, type AppointmentMove, type MovableAppointment, type MoveDestination, type MoveStaff } from "@/lib/calendar/appointment-move"
import type { SalonOpeningHours } from "@/lib/calendar/scheduling"

export function useAppointmentMove<T extends MovableAppointment>({ appointments, staff, openingHours, onRefresh }: {
  appointments: T[]
  staff: MoveStaff[]
  openingHours?: SalonOpeningHours | null
  onRefresh: () => unknown
}) {
  const [activeAppointment, setActiveAppointment] = useState<T | null>(null)
  const [pendingMove, setPendingMove] = useState<AppointmentMove | null>(null)
  const [isMovingAppointment, setIsMovingAppointment] = useState(false)
  const [moveError, setMoveError] = useState("")
  const saving = useRef(false)
  const validate = (appointment: MovableAppointment, destination: MoveDestination) => planAppointmentMove({ appointment, destination, appointments, staff, openingHours })
  const handleDragStart = (event: DragStartEvent) => {
    const appointment = event.active.data.current?.appointment as T | undefined
    if (!saving.current && appointment && canMoveAppointment(appointment)) {
      setMoveError("")
      setActiveAppointment(appointment)
    }
  }
  const handleDragCancel = () => setActiveAppointment(null)
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveAppointment(null)
    if (saving.current || pendingMove || !event.over) return
    const appointment = event.active.data.current?.appointment as T | undefined
    const destination = event.over.data.current as MoveDestination | undefined
    if (!appointment || !destination) return
    try { setMoveError(""); setPendingMove(validate(appointment, destination)) }
    catch (error) { toast.error("Déplacement impossible", { description: error instanceof Error ? error.message : "Actualisez le planning puis réessayez." }) }
  }
  const cancelMove = () => { if (!saving.current) { setPendingMove(null); setMoveError("") } }
  const confirmMove = async () => {
    if (saving.current || !pendingMove) return
    saving.current = true
    setIsMovingAppointment(true)
    setMoveError("")
    try {
      const latest = appointments.find(item => item.id === pendingMove.appointment.id)
      if (!latest || appointmentMoveVersion(latest) !== appointmentMoveVersion(pendingMove.appointment)) throw new Error("Ce rendez-vous a été modifié depuis votre sélection. Fermez cette fenêtre et actualisez le planning.")
      const move = validate(latest, pendingMove.destination)
      if (!move) { setPendingMove(null); return }
      const response = await fetch(`/api/appointments/${move.appointment.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_time: move.start.toISOString(), staff_id: move.staffIds[0], staff_ids: move.staffIds,
          expected_updated_at: move.appointment.updated_at || undefined }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Le créneau n’a pas pu être réservé. Aucun déplacement n’est affiché sans confirmation du serveur.")
      }
      setPendingMove(null)
      toast.success("Rendez-vous déplacé", { description: `${formatInTimeZone(move.start, "Europe/Paris", "dd/MM/yyyy HH:mm")}–${formatInTimeZone(move.end, "Europe/Paris", "HH:mm")}` })
    } catch (error) {
      setMoveError(error instanceof TypeError ? "La confirmation du déplacement n’a pas été reçue. Actualisez le planning avant de réessayer." : error instanceof Error ? error.message : "Impossible de déplacer ce rendez-vous.")
    } finally {
      saving.current = false
      setIsMovingAppointment(false)
      // Reconcile with the server on success AND on a concurrent conflict.
      void Promise.resolve(onRefresh()).catch(() => {})
    }
  }
  const isInvalidDestination = (destination: MoveDestination) => {
    if (!activeAppointment) return false
    try { validate(activeAppointment, destination); return false } catch { return true }
  }
  return { activeAppointment, setActiveAppointment, pendingMove, setPendingMove, isMovingAppointment, moveError,
    handleDragStart, handleDragEnd, handleDragCancel, confirmMove, cancelMove, isInvalidDestination }
}
