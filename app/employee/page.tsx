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
      return "border-amber-300 bg-amber-100 text-amber-950"
    case "completed":
      return "border-emerald-300 bg-emerald-100 text-emerald-950"
    case "no_show":
      return "border-orange-300 bg-orange-100 text-orange-950"
    case "cancelled":
      return "border-rose-300 bg-rose-100 text-rose-950"
    default:
      return "border-sky-300 bg-sky-100 text-sky-950"
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
    <div className="min-h-screen bg-[#f4f1ea] px-3 pb-7 pt-3 sm:px-6">
      <div className="mx-auto max-w-xl space-y-3">
        <header className="rounded-xl bg-[#221d16] p-3.5 text-white shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Hello</p>
          <h1 className="mt-0.5 text-2xl font-bold leading-tight">
            {userInfo?.first_name || "Therapist"}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {formatInTimeZone(new Date(), TIMEZONE, "EEEE d MMMM")}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/12 p-2.5">
              <p className="text-[11px] text-white/75">Today</p>
              <p className="text-xl font-bold">{todayAppointments.length}</p>
            </div>
            <div className="rounded-lg bg-white/12 p-2.5">
              <p className="text-[11px] text-white/75">To do</p>
              <p className="text-xl font-bold">{openCount}</p>
            </div>
            <div className="rounded-lg bg-white/12 p-2.5">
              <p className="text-[11px] text-white/75">Done</p>
              <p className="text-xl font-bold">{doneCount}</p>
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-black/10 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#221d16]">Next</h2>
            <Clock className="h-4 w-4 text-[#6b6258]" />
          </div>

          {nextAppointment ? (
            <div className="mt-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold tabular-nums text-[#221d16]">
                    {formatTime(nextAppointment.start_time)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[#6b6258]">
                    {formatTime(nextAppointment.start_time)} - {formatTime(nextAppointment.end_time)}
                  </p>
                </div>
                <Badge className={cn("border px-2 py-0.5 text-[11px]", getStatusClass(nextAppointment.status))}>
                  {getShortStatus(nextAppointment.status)}
                </Badge>
              </div>

              <p className="mt-3 text-lg font-bold leading-tight text-[#221d16]">{getServiceName(nextAppointment)}</p>
              <p className="mt-1 text-sm text-[#6b6258]">{getClientName(nextAppointment)}</p>

              <Link href="/employee/calendar" className="mt-3 block">
                <Button className="h-11 w-full rounded-xl text-sm font-bold">
                  {nextAppointment.status === "in_progress" ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  Open
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-[#f4f1ea] p-4 text-center">
              <p className="font-bold text-[#221d16]">No next appointment</p>
              <p className="mt-1 text-sm text-[#6b6258]">Nothing to start now.</p>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#221d16]">Today list</h2>
            <Link href="/employee/calendar">
              <Button variant="outline" size="sm" className="h-9 rounded-full border-black/15">
                <Calendar className="mr-2 h-4 w-4" />
                Calendar
              </Button>
            </Link>
          </div>

          {todayAppointments.slice(0, 4).map((appointment) => (
            <Link
              key={appointment.id}
              href="/employee/calendar"
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-bold tabular-nums text-[#221d16]">{formatTime(appointment.start_time)}</p>
                <p className="truncate text-sm font-semibold text-[#221d16]">{getServiceName(appointment)}</p>
                <p className="truncate text-xs text-[#6b6258]">{getClientName(appointment)}</p>
              </div>
              <Badge className={cn("shrink-0 border px-2 py-0.5 text-[11px]", getStatusClass(appointment.status))}>
                {getShortStatus(appointment.status)}
              </Badge>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
