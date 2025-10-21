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
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Weekly Schedule</h3>
          <p className="text-sm text-muted-foreground">
            {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={previousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Day Headers */}
          <div className="flex gap-2 mb-4">
            <div className="w-20 flex-shrink-0" />
            {weekDates.map((date, idx) => (
              <div key={idx} className="w-32 flex-shrink-0 text-center">
                <p className="text-sm font-semibold">{date.toLocaleDateString("en-US", { weekday: "short" })}</p>
                <p className="text-xs text-muted-foreground">{date.toLocaleDateString()}</p>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {timeSlots.map((time) => (
            <div key={time} className="flex gap-2 mb-2">
              <div className="w-20 flex-shrink-0 text-sm font-medium text-muted-foreground pt-2">{time}</div>
              {weekDates.map((date, idx) => {
                const apt = getAppointmentForSlot(date, time)
                return (
                  <div key={idx} className="w-32 flex-shrink-0">
                    {apt ? (
                      <div className={`p-2 rounded border text-xs ${getStatusColor(apt.status)}`}>
                        <p className="font-semibold truncate">{apt.clientName}</p>
                        <p className="truncate">{apt.service}</p>
                      </div>
                    ) : (
                      <div className="p-2 rounded border border-dashed border-muted-foreground/30 text-xs text-muted-foreground text-center">
                        Available
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
