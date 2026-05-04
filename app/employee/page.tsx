"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { formatInTimeZone } from "date-fns-tz"
import { Calendar, CheckCircle2, Clock, PlayCircle } from "lucide-react"
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
  client?: { first_name?: string | null; last_name?: string | null } | null
  service?: { name?: string | null } | null
  clients?: { first_name?: string | null; last_name?: string | null } | null
  services?: { name?: string | null } | null
}

const TIMEZONE = "Europe/Paris"

function getClientName(appointment: EmployeeAppointment) {
  const client = appointment.client || appointment.clients
  return `${client?.first_name || ""} ${client?.last_name || "Client"}`.trim()
}

function getServiceName(appointment: EmployeeAppointment) {
  return appointment.service?.name || appointment.services?.name || "Prestation"
}

function getStatusClass(status: AppointmentStatus) {
  switch (status) {
    case "in_progress":
      return "border-[#f4b740] bg-[#fff4cf] text-[#5c3d00]"
    case "completed":
      return "border-[#75c7a1] bg-[#e8f8ef] text-[#0b4936]"
    case "no_show":
      return "border-[#e6a36f] bg-[#fff3e8] text-[#74380d]"
    case "cancelled":
      return "border-[#f0a0a7] bg-[#fff0f1] text-[#7b1e2b]"
    default:
      return "border-[#9cc9bf] bg-[#e8f6f2] text-[#0f4c43]"
  }
}

function getShortStatus(status: AppointmentStatus) {
  if (status === "in_progress") return "En cours"
  if (status === "completed") return "Terminé"
  if (status === "no_show") return "Absent"
  if (status === "cancelled") return "Annulé"
  return "Confirmé"
}

export default function EmployeeDashboard() {
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    const adminUser = localStorage.getItem("adminUser")
    if (adminUser) {
      setUserInfo(JSON.parse(adminUser))
    }
  }, [])

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["staff-appointments", userInfo?.id],
    queryFn: () => userInfo?.id ? fetchAPI<EmployeeAppointment[]>(`/staff/${userInfo.id}/appointments`) : [],
    enabled: Boolean(userInfo?.id),
    retry: 1,
    staleTime: 30000,
  })

  const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd")
  const todayAppointments = useMemo(() => (
    appointments
      .filter((appointment) => formatInTimeZone(appointment.start_time, TIMEZONE, "yyyy-MM-dd") === today)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  ), [appointments, today])

  const activeAppointment = todayAppointments.find((appointment) => appointment.status === "in_progress")
  const nextAppointment = activeAppointment || todayAppointments.find((appointment) =>
    ["confirmed", "pending"].includes(appointment.status) &&
    new Date(appointment.end_time).getTime() >= Date.now()
  )
  const doneCount = todayAppointments.filter((appointment) => appointment.status === "completed").length
  const openCount = todayAppointments.filter((appointment) => ["confirmed", "pending", "in_progress"].includes(appointment.status)).length

  const formatTime = (dateTime: string) => formatInTimeZone(dateTime, TIMEZONE, "HH:mm")

  if (isLoading) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/25" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f7f2] px-3 pb-7 pt-3 sm:px-6">
      <div className="mx-auto max-w-xl space-y-3">
        <header className="rounded-2xl bg-[#123f38] p-3.5 text-white shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#cfe7df]">Bonjour</p>
          <h1 className="mt-0.5 text-2xl font-bold leading-tight">
            {userInfo?.first_name || "Thérapeute"}
          </h1>
          <p className="mt-1 text-sm font-medium text-[#d7eee7]">
            {formatInTimeZone(new Date(), TIMEZONE, "EEEE d MMMM")}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/12 p-2.5">
              <p className="text-[11px] text-[#d7eee7]">Aujourd'hui</p>
              <p className="text-xl font-bold">{todayAppointments.length}</p>
            </div>
            <div className="rounded-xl bg-white/12 p-2.5">
              <p className="text-[11px] text-[#d7eee7]">À faire</p>
              <p className="text-xl font-bold">{openCount}</p>
            </div>
            <div className="rounded-xl bg-white/12 p-2.5">
              <p className="text-[11px] text-[#d7eee7]">Terminés</p>
              <p className="text-xl font-bold">{doneCount}</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-[#dfe5dd] bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#102d28]">Prochain</h2>
            <Clock className="h-4 w-4 text-[#53615b]" />
          </div>

          {nextAppointment ? (
            <div className="mt-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold tabular-nums text-[#102d28]">
                    {formatTime(nextAppointment.start_time)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[#53615b]">
                    {formatTime(nextAppointment.start_time)} - {formatTime(nextAppointment.end_time)}
                  </p>
                </div>
                <Badge className={cn("border px-2.5 py-1 text-[11px] font-bold", getStatusClass(nextAppointment.status))}>
                  {getShortStatus(nextAppointment.status)}
                </Badge>
              </div>

              <p className="mt-3 text-lg font-bold leading-tight text-[#102d28]">{getServiceName(nextAppointment)}</p>
              <p className="mt-1 text-sm font-medium text-[#53615b]">{getClientName(nextAppointment)}</p>

              <Link href="/employee/calendar" className="mt-3 block">
                <Button className="h-11 w-full rounded-xl bg-[#0f4c43] text-sm font-bold text-white hover:bg-[#0b3d36]">
                  {nextAppointment.status === "in_progress" ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  Ouvrir
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-[#eef4ef] p-4 text-center">
              <p className="font-bold text-[#102d28]">Aucun prochain rendez-vous</p>
              <p className="mt-1 text-sm text-[#53615b]">Rien à lancer maintenant.</p>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#102d28]">Planning du jour</h2>
            <Link href="/employee/calendar">
              <Button variant="outline" size="sm" className="h-9 rounded-full border-[#b7d8cd] bg-white text-[#0f4c43]">
                <Calendar className="mr-2 h-4 w-4" />
                Agenda
              </Button>
            </Link>
          </div>

          {todayAppointments.slice(0, 4).map((appointment) => (
            <Link
              key={appointment.id}
              href="/employee/calendar"
              className="flex items-center justify-between gap-3 rounded-2xl border border-[#dfe5dd] bg-white p-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-bold tabular-nums text-[#102d28]">{formatTime(appointment.start_time)}</p>
                <p className="truncate text-sm font-semibold text-[#102d28]">{getServiceName(appointment)}</p>
                <p className="truncate text-xs font-medium text-[#53615b]">{getClientName(appointment)}</p>
              </div>
              <Badge className={cn("shrink-0 border px-2.5 py-1 text-[11px] font-bold", getStatusClass(appointment.status))}>
                {getShortStatus(appointment.status)}
              </Badge>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
