"use client"

import { useRef, useState } from "react"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { toast } from "sonner"
import { formatInTimeZone } from "date-fns-tz"
import { appointmentMoveVersion, canMoveAppointment, planAppointmentMove, type AppointmentMove, type AppointmentMoveMode, type MovableAppointment, type MoveDestination, type MoveStaff } from "@/lib/calendar/appointment-move"
import type { SalonOpeningHours } from "@/lib/calendar/scheduling"

export function useAppointmentMove<T extends MovableAppointment>({ appointments, staff, openingHours, onRefresh, mode = "strict", salonId }: {
  appointments: T[]
  staff: MoveStaff[]
  openingHours?: SalonOpeningHours | null
  onRefresh: () => unknown
  mode?: AppointmentMoveMode
  salonId?: string
}) {
  const [activeAppointment, setActiveAppointment] = useState<T | null>(null)
  const [isMovingAppointment, setIsMovingAppointment] = useState(false)
  const [moveError, setMoveError] = useState("")
  const saving = useRef(false)
  const current = useRef({ appointments, staff, openingHours, onRefresh, mode, salonId })
  current.current = { appointments, staff, openingHours, onRefresh, mode, salonId }

  const validate = (appointment: MovableAppointment, destination: MoveDestination) => {
    const context = current.current
    if (context.mode === "salon-admin" && context.salonId && appointment.salon_id !== context.salonId) throw new Error("Ce rendez-vous n’appartient pas au salon affiché. Actualisez le planning.")
    return planAppointmentMove({ appointment, destination, appointments: context.appointments, staff: context.staff, openingHours: context.openingHours, mode: context.mode })
  }

  const saveMove = async (planned: AppointmentMove, retry = false) => {
    if (saving.current) return
    saving.current = true
    setIsMovingAppointment(true)
    setMoveError("")
    let recoverable = false
    try {
      const context = current.current
      if (planned.mode !== context.mode || (context.salonId && planned.appointment.salon_id !== context.salonId)) throw new Error("Le salon affiché a changé. Recommencez le déplacement depuis son planning.")
      const latest = context.appointments.find(item => item.id === planned.appointment.id)
      if (!retry && (!latest || appointmentMoveVersion(latest) !== appointmentMoveVersion(planned.appointment))) throw new Error("Ce rendez-vous a été modifié depuis votre sélection. Actualisez le planning puis réessayez.")
      // A retry reuses the original version and request ID: the server may already have committed it.
      const move = retry ? planned : validate(latest!, planned.destination)
      if (!move) return
      const salonMove = planned.mode === "salon-admin"
      if (salonMove && (!planned.requestId || !(context.salonId || move.appointment.salon_id))) throw new Error("Recommencez le déplacement depuis le planning du salon.")
      if (salonMove && (!move.appointment.updated_at || !Number.isFinite(Date.parse(move.appointment.updated_at)))) throw new Error("Actualisez le planning pour récupérer la version du rendez-vous avant de le déplacer.")
      let response: Response
      try {
        response = await fetch(salonMove
          ? `/api/admin/salons/${context.salonId || move.appointment.salon_id}/appointments/${move.appointment.id}/move`
          : `/api/appointments/${move.appointment.id}`, {
          method: salonMove ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(salonMove
            ? { start_time: move.start.toISOString(), staff_ids: move.staffIds, expected_updated_at: move.appointment.updated_at, request_id: planned.requestId }
            : { start_time: move.start.toISOString(), staff_id: move.staffIds[0], staff_ids: move.staffIds, expected_updated_at: move.appointment.updated_at || undefined }),
        })
      } catch (error) {
        recoverable = salonMove
        throw error
      }
      if (!response.ok) {
        recoverable = salonMove && response.status >= 500
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Le déplacement n’a pas pu être enregistré.")
      }
      toast.success("Rendez-vous déplacé", { description: `${formatInTimeZone(move.start, "Europe/Paris", "dd/MM/yyyy HH:mm")}–${formatInTimeZone(move.end, "Europe/Paris", "HH:mm")}` })
    } catch (error) {
      const message = error instanceof TypeError
        ? "La réponse du serveur n’a pas été reçue. Le planning va être actualisé."
        : error instanceof Error ? error.message : "Impossible de déplacer ce rendez-vous."
      setMoveError(message)
      toast.error(recoverable ? "Résultat du déplacement à vérifier" : "Déplacement impossible", {
        description: message,
        ...(recoverable ? { action: { label: "Réessayer", onClick: () => { void saveMove(planned, true) } } } : {}),
      })
    } finally {
      saving.current = false
      setIsMovingAppointment(false)
      void Promise.resolve(current.current.onRefresh()).catch(() => {})
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const appointment = event.active.data.current?.appointment as T | undefined
    if (!saving.current && appointment && canMoveAppointment(appointment, mode)) {
      setMoveError("")
      setActiveAppointment(appointment)
    }
  }
  const handleDragCancel = () => setActiveAppointment(null)
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveAppointment(null)
    if (saving.current || !event.over) return
    const appointment = event.active.data.current?.appointment as T | undefined
    const destination = event.over.data.current as MoveDestination | undefined
    if (!appointment || !destination) return
    try {
      const move = validate(appointment, destination)
      if (move) await saveMove(mode === "salon-admin" ? { ...move, requestId: crypto.randomUUID() } : move)
    } catch (error) {
      toast.error("Déplacement impossible", { description: error instanceof Error ? error.message : "Actualisez le planning puis réessayez." })
    }
  }
  const cancelMove = () => { if (!saving.current) setMoveError("") }
  const isInvalidDestination = (destination: MoveDestination) => {
    if (!activeAppointment) return false
    try { validate(activeAppointment, destination); return false } catch { return true }
  }
  return { activeAppointment, setActiveAppointment, isMovingAppointment, moveError,
    handleDragStart, handleDragEnd, handleDragCancel, cancelMove, isInvalidDestination }
}
