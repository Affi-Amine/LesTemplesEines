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
import { fr } from "date-fns/locale"
import { toZonedTime, formatInTimeZone } from "date-fns-tz"

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

  const { data: appointments = [], isLoading, error } = useQuery({
    queryKey: ["staff-appointments", staffId],
    queryFn: async () => {
      if (!staffId) {
        console.warn("No staff ID available for calendar")
        return []
      }
      try {
        const response = await fetch(`/api/staff/${staffId}/appointments`)
        if (!response.ok) {
          console.error("Failed to fetch appointments:", response.status, response.statusText)
          return []
        }
        return response.json()
      } catch (error) {
        console.error("Error fetching appointments for calendar:", error)
        return []
      }
    },
    enabled: !!staffId,
    retry: 1,
    staleTime: 30000,
  })

  const getAppointmentsForDate = (date: Date) => {
    if (!date || !Array.isArray(appointments)) return []

    const dateStr = format(date, "yyyy-MM-dd")
    return appointments.filter((apt: Appointment) => {
      if (!apt?.start_time) return false
      try {
        const parisDateStr = formatInTimeZone(apt.start_time, "Europe/Paris", "yyyy-MM-dd")
        return parisDateStr === dateStr
      } catch (error) {
        console.error("Error filtering appointment by date:", error)
        return false
      }
    })
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
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "completed":
        return "bg-indigo-100 text-indigo-800 border-indigo-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatTime = (dateTime: string) => {
    return formatInTimeZone(dateTime, "Europe/Paris", "HH:mm")
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
        <div className="text-lg">Chargement du calendrier...</div>
      </div>
    )
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmé"
      case "pending":
        return "En attente"
      case "cancelled":
        return "Annulé"
      case "in_progress":
        return "En cours"
      case "completed":
        return "Terminé"
      case "no_show":
        return "Absence"
      default:
        return status
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Mon calendrier</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sélectionner une date</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="w-full"
              modifiers={{
                hasAppointments: appointments
                  .filter((apt: Appointment) => apt?.start_time) // Safety check
                  .map((apt: Appointment) => {
                    try {
                      const dateStr = apt.start_time.split("T")[0]
                      return new Date(dateStr)
                    } catch (error) {
                      console.error("Error parsing date:", apt.start_time, error)
                      return new Date() // Fallback to current date
                    }
                  })
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
                  {selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                </span>
              </div>
              <Badge variant="outline" className="self-start sm:ml-auto">
                {dayAppointments.length} rendez-vous
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {dayAppointments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">Aucun rendez-vous prévu pour cette date</p>
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
                              {getStatusLabel(appointment.status)}
                            </Badge>
                            <span className="font-medium text-base sm:text-lg">
                              {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                            </span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-gray-600">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm sm:text-base">
                                {appointment.clients?.first_name || ''} {appointment.clients?.last_name || 'Client'}
                              </span>
                            </div>
                            {appointment.clients?.phone && (
                              <span className="text-xs sm:text-sm ml-6 sm:ml-0">
                                • {appointment.clients.phone}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-gray-600">
                            <span className="font-medium text-sm sm:text-base">
                              {appointment.services?.name || 'Service'}
                            </span>
                            <div className="flex items-center gap-2 text-xs sm:text-sm">
                              {appointment.services?.duration_minutes && (
                                <span>• {formatDuration(appointment.services.duration_minutes)}</span>
                              )}
                              {appointment.services?.price_cents && (
                                <span>• €{(appointment.services.price_cents / 100).toFixed(2)}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-2 text-gray-600">
                            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span className="text-xs sm:text-sm">
                              {appointment.salons?.name || 'Salon'}{appointment.salons?.city && `, ${appointment.salons.city}`}
                            </span>
                          </div>

                          {appointment.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs sm:text-sm">
                              <strong>Notes :</strong> {appointment.notes}
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
                          Voir les détails
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
