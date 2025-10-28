"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppointmentDetailsModal } from "@/components/appointment-details-modal"
import { CalendarIcon, Clock, User, MapPin } from "lucide-react"
import { format } from "date-fns"

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: string
  notes?: string
  client_notes?: string
  clients: {
    id: string
    first_name: string
    last_name: string
    phone: string
    email: string
  }
  services: {
    id: string
    name: string
    duration_minutes: number
    price_cents: number
    category?: string
    description?: string
  }
  salons: {
    id: string
    name: string
    city: string
    address: string
  }
}

export default function EmployeeCalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [staffId, setStaffId] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const user = localStorage.getItem("adminUser")
    if (user) {
      const userData = JSON.parse(user)
      setStaffId(userData.id)
    }
  }, [])

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["staff-appointments", staffId],
    queryFn: async () => {
      if (!staffId) return []
      const response = await fetch(`/api/staff/${staffId}/appointments`)
      if (!response.ok) throw new Error("Failed to fetch appointments")
      return response.json()
    },
    enabled: !!staffId,
  })

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    return appointments.filter((apt: Appointment) => 
      apt.start_time.startsWith(dateStr)
    )
  }

  const dayAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : []

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatTime = (dateTime: string) => {
    return format(new Date(dateTime), "HH:mm")
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ""}`
    }
    return `${mins}m`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading calendar...</div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">My Calendar</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Select Date</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Calendar 
              mode="single" 
              selected={selectedDate} 
              onSelect={setSelectedDate} 
              className="w-full"
              modifiers={{
                hasAppointments: appointments.map((apt: Appointment) => 
                  new Date(apt.start_time.split("T")[0])
                )
              }}
              modifiersStyles={{
                hasAppointments: { 
                  backgroundColor: "#dbeafe", 
                  color: "#1e40af",
                  fontWeight: "bold"
                }
              }}
            />
          </CardContent>
        </Card>

        {/* Appointments for Selected Date */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span className="text-base sm:text-lg">
                  {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
                </span>
              </div>
              <Badge variant="outline" className="self-start sm:ml-auto">
                {dayAppointments.length} appointment{dayAppointments.length !== 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {dayAppointments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No appointments scheduled for this date</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dayAppointments.map((appointment: Appointment) => (
                  <Card key={appointment.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <Badge className={getStatusColor(appointment.status)}>
                              {appointment.status}
                            </Badge>
                            <span className="font-medium text-base sm:text-lg">
                              {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                            </span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-gray-600">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm sm:text-base">
                                {appointment.clients.first_name} {appointment.clients.last_name}
                              </span>
                            </div>
                            <span className="text-xs sm:text-sm ml-6 sm:ml-0">
                              • {appointment.clients.phone}
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-gray-600">
                            <span className="font-medium text-sm sm:text-base">
                              {appointment.services.name}
                            </span>
                            <div className="flex items-center gap-2 text-xs sm:text-sm">
                              <span>• {formatDuration(appointment.services.duration_minutes)}</span>
                              <span>• €{(appointment.services.price_cents / 100).toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 text-gray-600">
                            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span className="text-xs sm:text-sm">
                              {appointment.salons.name}, {appointment.salons.city}
                            </span>
                          </div>

                          {appointment.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs sm:text-sm">
                              <strong>Notes:</strong> {appointment.notes}
                            </div>
                          )}
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full sm:w-auto flex-shrink-0"
                          onClick={() => {
                            setSelectedAppointment(appointment)
                            setIsModalOpen(true)
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AppointmentDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
      />
    </div>
  )
}