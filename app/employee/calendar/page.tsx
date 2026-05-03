"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { addDays, format } from "date-fns"
import { fr } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { CalendarDays, Clock, MapPin, Phone, User } from "lucide-react"
import { AppointmentDetailsModal } from "@/components/appointment-details-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchAPI } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type AppointmentStatus = "confirmed" | "pending" | "in_progress" | "completed" | "cancelled" | "no_show" | "blocked"

interface EmployeeAppointment {
  id: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes?: string | null
  client_notes?: string | null
  client?: {
    id: string
    first_name: string
    last_name: string
    phone?: string | null
    email?: string | null
  } | null
  service?: {
    id: string
    name: string
    duration_minutes: number
    price_cents: number
  } | null
  salon?: {
    id: string
    name: string
    city?: string | null
    address?: string | null
  } | null
  clients?: EmployeeAppointment["client"]
  services?: EmployeeAppointment["service"]
  salons?: EmployeeAppointment["salon"]
}

const TIMEZONE = "Europe/Paris"

function getClient(appointment: EmployeeAppointment) {
  return appointment.client || appointment.clients
}

function getService(appointment: EmployeeAppointment) {
  return appointment.service || appointment.services
}

function getSalon(appointment: EmployeeAppointment) {
  return appointment.salon || appointment.salons
}

function getStatusText(status: AppointmentStatus) {
  switch (status) {
    case "in_progress":
      return "NOW"
    case "completed":
      return "DONE"
    case "cancelled":
      return "CANCEL"
    case "no_show":
      return "ABSENT"
    case "pending":
      return "WAIT"
    default:
      return "OK"
  }
}

function getStatusClass(status: AppointmentStatus) {
  switch (status) {
    case "in_progress":
      return "border-amber-200 bg-amber-100 text-amber-900"
    case "completed":
      return "border-emerald-200 bg-emerald-100 text-emerald-900"
    case "cancelled":
      return "border-rose-200 bg-rose-100 text-rose-900"
    case "no_show":
      return "border-orange-200 bg-orange-100 text-orange-900"
    case "pending":
      return "border-slate-200 bg-slate-100 text-slate-700"
    default:
      return "border-sky-200 bg-sky-100 text-sky-900"
  }
}

export default function EmployeeCalendarPage() {
  const [selectedDate, setSelectedDate] = useState(() => formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd"))
  const [staffId, setStaffId] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<EmployeeAppointment | null>(null)

  useEffect(() => {
    const user = localStorage.getItem("adminUser")
    if (user) {
      setStaffId(JSON.parse(user).id)
    }
  }, [])

  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 10 }, (_, index) => {
      const date = addDays(today, index)
      const value = formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd")
      return {
        value,
        day: format(date, "EEE", { locale: fr }).replace(".", ""),
        number: format(date, "d", { locale: fr }),
      }
    })
  }, [])

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["staff-appointments", staffId],
    queryFn: () => staffId ? fetchAPI<EmployeeAppointment[]>(`/staff/${staffId}/appointments`) : [],
    enabled: Boolean(staffId),
    retry: 1,
    staleTime: 30000,
  })

  const dayAppointments = useMemo(() => (
    appointments
      .filter((appointment) => formatInTimeZone(appointment.start_time, TIMEZONE, "yyyy-MM-dd") === selectedDate)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  ), [appointments, selectedDate])

  const activeAppointment = dayAppointments.find((appointment) => appointment.status === "in_progress")
  const nextAppointment = dayAppointments.find((appointment) =>
    ["confirmed", "pending", "in_progress"].includes(appointment.status) &&
    new Date(appointment.end_time).getTime() >= Date.now()
  )

  const formatTime = (dateTime: string) => formatInTimeZone(dateTime, TIMEZONE, "HH:mm")
  const selectedDateLabel = formatInTimeZone(`${selectedDate}T12:00:00`, TIMEZONE, "EEEE d MMMM", { locale: fr })

  if (isLoading) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center px-4">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/25" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f3ed] px-3 pb-24 pt-4 sm:px-6">
      <div className="mx-auto max-w-xl space-y-4">
        <header className="rounded-[1.25rem] bg-[#181612] p-4 text-white shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/55">Today</p>
              <h1 className="mt-1 text-2xl font-bold">My appointments</h1>
            </div>
            <CalendarDays className="h-7 w-7 text-primary" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/60">Total</p>
              <p className="text-2xl font-bold">{dayAppointments.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/60">Now</p>
              <p className="truncate text-lg font-bold">{activeAppointment ? formatTime(activeAppointment.start_time) : "-"}</p>
            </div>
          </div>
        </header>

        <div className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none]">
          <div className="flex min-w-max gap-2 pb-1">
            {days.map((day) => {
              const isSelected = day.value === selectedDate
              const count = appointments.filter((appointment) =>
                formatInTimeZone(appointment.start_time, TIMEZONE, "yyyy-MM-dd") === day.value
              ).length

              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setSelectedDate(day.value)}
                  className={cn(
                    "flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border text-sm shadow-sm transition",
                    isSelected
                      ? "border-[#181612] bg-[#181612] text-white"
                      : "border-black/5 bg-white text-[#181612]"
                  )}
                >
                  <span className="text-xs uppercase opacity-65">{day.day}</span>
                  <span className="text-xl font-bold">{day.number}</span>
                  <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", count > 0 ? "bg-primary" : "bg-transparent")} />
                </button>
              )
            })}
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold capitalize text-[#181612]">{selectedDateLabel}</h2>
            {nextAppointment ? (
              <Badge className="border-amber-200 bg-amber-100 text-amber-900">
                Next {formatTime(nextAppointment.start_time)}
              </Badge>
            ) : null}
          </div>

          {dayAppointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-muted-foreground">
              No appointment
            </div>
          ) : (
            <div className="space-y-3">
              {dayAppointments.map((appointment) => {
                const client = getClient(appointment)
                const service = getService(appointment)
                const salon = getSalon(appointment)
                const clientName = `${client?.first_name || ""} ${client?.last_name || "Client"}`.trim()

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelectedAppointment(appointment)}
                    className={cn(
                      "w-full rounded-[1.25rem] border bg-white p-4 text-left shadow-sm transition active:scale-[0.99]",
                      appointment.status === "in_progress" ? "border-amber-300 ring-2 ring-amber-100" : "border-black/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl font-black tabular-nums text-[#181612]">
                          {formatTime(appointment.start_time)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                        </p>
                      </div>
                      <Badge className={cn("border px-2.5 py-1 text-xs", getStatusClass(appointment.status))}>
                        {getStatusText(appointment.status)}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-lg font-bold leading-tight text-[#181612]">{service?.name || "Service"}</p>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="truncate">{clientName}</span>
                      </p>
                      {client?.phone ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{client.phone}</span>
                        </p>
                      ) : null}
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{salon?.name || "Salon"}</span>
                      </p>
                    </div>

                    {appointment.client_notes || appointment.notes ? (
                      <div className="mt-3 rounded-xl bg-[#f7f3ed] px-3 py-2 text-sm text-[#181612]">
                        {appointment.client_notes || appointment.notes}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Selected</p>
            <p className="text-sm font-bold capitalize">{selectedDateLabel}</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-bold text-[#181612]">
            <Clock className="h-4 w-4" />
            {dayAppointments.length}
          </div>
        </div>
      </div>

      <AppointmentDetailsModal
        isOpen={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointment(null)}
        appointment={selectedAppointment}
      />
    </div>
  )
}
