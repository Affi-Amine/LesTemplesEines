"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ScheduleViewProps {
  appointments: Array<{
    id: string
    date: string
    time: string
    clientName: string
    service: string
    therapist: string
    status: string
  }>
}

export function ScheduleView({ appointments }: ScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const getWeekDates = () => {
    const dates = []
    const curr = new Date(currentDate)
    const first = curr.getDate() - curr.getDay()

    for (let i = 0; i < 7; i++) {
      const date = new Date(curr.setDate(first + i))
      dates.push(new Date(date))
    }
    return dates
  }

  const weekDates = getWeekDates()
  const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]

  const getAppointmentForSlot = (date: Date, time: string) => {
    const dateStr = date.toISOString().split("T")[0]
    return appointments.find((apt) => apt.date === dateStr && apt.time === time)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-300"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const previousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const nextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  return (
    <Card className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Planning hebdomadaire</h3>
          <p className="truncate text-sm text-muted-foreground">
            {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={previousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="overflow-x-hidden md:overflow-x-auto">
        <div className="min-w-0 md:min-w-max">
          {/* Day Headers */}
          <div className="mb-2 grid grid-cols-8 gap-0.5 sm:mb-4 sm:gap-2">
            <div className="min-w-0" />
            {weekDates.map((date, idx) => (
              <div key={idx} className="min-w-0 text-center">
                <p className="truncate text-[10px] font-semibold sm:text-sm">{date.toLocaleDateString("fr-FR", { weekday: "short" })}</p>
                <p className="hidden text-xs text-muted-foreground sm:block">{date.toLocaleDateString("fr-FR")}</p>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {timeSlots.map((time) => (
            <div key={time} className="mb-1 grid grid-cols-8 gap-0.5 sm:mb-2 sm:gap-2">
              <div className="pt-2 text-right text-[9px] font-medium text-muted-foreground sm:text-sm">{time}</div>
              {weekDates.map((date, idx) => {
                const apt = getAppointmentForSlot(date, time)
                return (
                  <div key={idx} className="min-w-0">
                    {apt ? (
                      <div className={`overflow-hidden rounded border p-1 text-[9px] sm:p-2 sm:text-xs ${getStatusColor(apt.status)}`}>
                        <p className="font-semibold truncate">{apt.clientName}</p>
                        <p className="hidden truncate sm:block">{apt.service}</p>
                      </div>
                    ) : (
                      <div className="rounded border border-dashed border-muted-foreground/30 p-1 text-center text-[8px] text-muted-foreground sm:p-2 sm:text-xs">
                        <span className="hidden sm:inline">Disponible</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
