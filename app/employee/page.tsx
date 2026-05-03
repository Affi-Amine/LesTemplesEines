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
  return appointment.service?.name || appointment.services?.name || "Service"
}

function getStatusClass(status: AppointmentStatus) {
  switch (status) {
    case "in_progress":
      return "border-amber-200 bg-amber-100 text-amber-900"
    case "completed":
      return "border-emerald-200 bg-emerald-100 text-emerald-900"
    case "no_show":
      return "border-orange-200 bg-orange-100 text-orange-900"
    case "cancelled":
      return "border-rose-200 bg-rose-100 text-rose-900"
    default:
      return "border-sky-200 bg-sky-100 text-sky-900"
  }
}

function getShortStatus(status: AppointmentStatus) {
  if (status === "in_progress") return "NOW"
  if (status === "completed") return "DONE"
  if (status === "no_show") return "ABSENT"
  if (status === "cancelled") return "CANCEL"
  return "OK"
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
    <div className="min-h-screen bg-[#f7f3ed] px-3 pb-8 pt-4 sm:px-6">
      <div className="mx-auto max-w-xl space-y-4">
        <header className="rounded-[1.25rem] bg-[#181612] p-4 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/55">Hello</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">
            {userInfo?.first_name || "Therapist"}
          </h1>
          <p className="mt-2 text-sm text-white/65">
            {formatInTimeZone(new Date(), TIMEZONE, "EEEE d MMMM")}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/60">Today</p>
              <p className="text-2xl font-black">{todayAppointments.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/60">To do</p>
              <p className="text-2xl font-black">{openCount}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/60">Done</p>
              <p className="text-2xl font-black">{doneCount}</p>
            </div>
          </div>
        </header>

        <section className="rounded-[1.25rem] border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-[#181612]">Next</h2>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>

          {nextAppointment ? (
            <div className="mt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-4xl font-black tabular-nums text-[#181612]">
                    {formatTime(nextAppointment.start_time)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-muted-foreground">
                    {formatTime(nextAppointment.start_time)} - {formatTime(nextAppointment.end_time)}
                  </p>
                </div>
                <Badge className={cn("border px-2.5 py-1", getStatusClass(nextAppointment.status))}>
                  {getShortStatus(nextAppointment.status)}
                </Badge>
              </div>

              <p className="mt-4 text-xl font-black leading-tight">{getServiceName(nextAppointment)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{getClientName(nextAppointment)}</p>

              <Link href="/employee/calendar" className="mt-4 block">
                <Button className="h-14 w-full rounded-2xl text-base font-black">
                  {nextAppointment.status === "in_progress" ? (
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                  ) : (
                    <PlayCircle className="mr-2 h-5 w-5" />
                  )}
                  Open
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-[#f7f3ed] p-5 text-center">
              <p className="font-black text-[#181612]">No next appointment</p>
              <p className="mt-1 text-sm text-muted-foreground">Nothing to start now.</p>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#181612]">Today list</h2>
            <Link href="/employee/calendar">
              <Button variant="outline" size="sm" className="rounded-full">
                <Calendar className="mr-2 h-4 w-4" />
                Calendar
              </Button>
            </Link>
          </div>

          {todayAppointments.slice(0, 4).map((appointment) => (
            <Link
              key={appointment.id}
              href="/employee/calendar"
              className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-black tabular-nums text-[#181612]">{formatTime(appointment.start_time)}</p>
                <p className="truncate text-sm font-semibold">{getServiceName(appointment)}</p>
                <p className="truncate text-xs text-muted-foreground">{getClientName(appointment)}</p>
              </div>
              <Badge className={cn("shrink-0 border px-2.5 py-1", getStatusClass(appointment.status))}>
                {getShortStatus(appointment.status)}
              </Badge>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
