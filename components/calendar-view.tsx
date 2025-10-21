"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface CalendarViewProps {
  appointments: Array<{
    id: string
    date: string
    time: string
    clientName: string
    service: string
    status: string
  }>
}

export function CalendarView({ appointments }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return appointments.filter((apt) => apt.date === dateStr)
  }

  const dayAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : []

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="p-4 md:col-span-1">
        <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="w-full" />
      </Card>

      {/* Appointments for Selected Date */}
      <Card className="p-6 md:col-span-2">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">
            {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          <p className="text-sm text-muted-foreground">{dayAppointments.length} appointments</p>
        </div>

        {dayAppointments.length > 0 ? (
          <div className="space-y-3">
            {dayAppointments.map((apt) => (
              <div key={apt.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50">
                <div>
                  <p className="font-semibold">{apt.time}</p>
                  <p className="text-sm text-muted-foreground">{apt.clientName}</p>
                  <p className="text-sm text-muted-foreground">{apt.service}</p>
                </div>
                <Badge className={getStatusColor(apt.status)}>
                  {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No appointments scheduled for this date</p>
            <Button className="mt-4">Schedule Appointment</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
