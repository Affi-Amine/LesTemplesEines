"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay, eachHourOfInterval } from "date-fns"
import { fr } from "date-fns/locale"
import { BookingDetailsModal } from "@/components/booking-details-modal"

interface Salon {
  id: string
  name: string
  city: string
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: string
  client: {
    first_name: string
    last_name: string
  }
  staff: {
    first_name: string
    last_name: string
  }
  service: {
    name: string
  }
  salon: {
    name: string
  }
}

// Week View Component
function WeekView({ currentDate, appointments, onAppointmentClick }: {
  currentDate: Date
  appointments: Appointment[]
  onAppointmentClick: (appointment: Appointment) => void
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = eachHourOfInterval({ start: startOfDay(new Date()), end: endOfDay(new Date()) })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800 border-green-200"
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed": return "bg-blue-100 text-blue-800 border-blue-200"
      case "cancelled": return "bg-red-100 text-red-800 border-red-200"
      case "no_show": return "bg-gray-100 text-gray-800 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getAppointmentsForDayAndHour = (day: Date, hour: Date) => {
    return appointments.filter(appointment => {
      const appointmentStart = new Date(appointment.start_time)
      return isSameDay(appointmentStart, day) && 
             appointmentStart.getHours() === hour.getHours()
    })
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header with days */}
        <div className="grid grid-cols-8 gap-1 mb-4">
          <div className="p-2"></div> {/* Empty cell for time column */}
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="p-2 text-center font-medium">
              <div className="text-sm text-muted-foreground">
                {format(day, "EEE", { locale: fr })}
              </div>
              <div className={`text-lg ${isSameDay(day, new Date()) ? "text-primary font-bold" : ""}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="space-y-1">
          {hours.filter(hour => hour.getHours() >= 8 && hour.getHours() <= 20).map((hour) => (
            <div key={hour.toISOString()} className="grid grid-cols-8 gap-1">
              <div className="p-2 text-sm text-muted-foreground text-right">
                {format(hour, "HH:mm")}
              </div>
              {weekDays.map((day) => {
                const hourAppointments = getAppointmentsForDayAndHour(day, hour)
                return (
                  <div key={`${day.toISOString()}-${hour.toISOString()}`} className="min-h-[60px] p-1 border border-border bg-background">
                    {hourAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className={`text-xs p-2 rounded border cursor-pointer hover:shadow-sm transition-shadow mb-1 ${getStatusColor(appointment.status)}`}
                        onClick={() => onAppointmentClick(appointment)}
                      >
                        <div className="font-medium truncate">
                          {appointment.client.first_name} {appointment.client.last_name}
                        </div>
                        <div className="truncate text-muted-foreground">
                          {appointment.service.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Day View Component
function DayView({ currentDate, appointments, onAppointmentClick }: {
  currentDate: Date
  appointments: Appointment[]
  onAppointmentClick: (appointment: Appointment) => void
}) {
  const hours = eachHourOfInterval({ start: startOfDay(new Date()), end: endOfDay(new Date()) })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800 border-green-200"
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed": return "bg-blue-100 text-blue-800 border-blue-200"
      case "cancelled": return "bg-red-100 text-red-800 border-red-200"
      case "no_show": return "bg-gray-100 text-gray-800 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getAppointmentsForHour = (hour: Date) => {
    return appointments.filter(appointment => {
      const appointmentStart = new Date(appointment.start_time)
      return isSameDay(appointmentStart, currentDate) && 
             appointmentStart.getHours() === hour.getHours()
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-1">
        {hours.filter(hour => hour.getHours() >= 8 && hour.getHours() <= 20).map((hour) => {
          const hourAppointments = getAppointmentsForHour(hour)
          return (
            <div key={hour.toISOString()} className="flex gap-4">
              <div className="w-20 p-2 text-sm text-muted-foreground text-right">
                {format(hour, "HH:mm")}
              </div>
              <div className="flex-1 min-h-[80px] p-2 border border-border bg-background rounded">
                {hourAppointments.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">Aucun rendez-vous</div>
                ) : (
                  <div className="space-y-2">
                    {hourAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className={`p-3 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(appointment.status)}`}
                        onClick={() => onAppointmentClick(appointment)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium">
                            {appointment.client.first_name} {appointment.client.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(appointment.start_time), "HH:mm")} - {format(new Date(appointment.end_time), "HH:mm")}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {appointment.service.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Thérapeute: {appointment.staff.first_name} {appointment.staff.last_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendrierPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedSalon, setSelectedSalon] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [salons, setSalons] = useState<Salon[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch salons
  useEffect(() => {
    const fetchSalons = async () => {
      try {
        const response = await fetch("/api/salons")
        if (response.ok) {
          const data = await response.json()
          setSalons(data)
        }
      } catch (error) {
        console.error("Erreur lors du chargement des salons:", error)
      }
    }
    fetchSalons()
  }, [])

  const navigate = (direction: "prev" | "next") => {
    if (direction === "prev") {
      switch (viewMode) {
        case "month":
          setCurrentDate(subMonths(currentDate, 1))
          break
        case "week":
          setCurrentDate(subWeeks(currentDate, 1))
          break
        case "day":
          setCurrentDate(subDays(currentDate, 1))
          break
      }
    } else {
      switch (viewMode) {
        case "month":
          setCurrentDate(addMonths(currentDate, 1))
          break
        case "week":
          setCurrentDate(addWeeks(currentDate, 1))
          break
        case "day":
          setCurrentDate(addDays(currentDate, 1))
          break
      }
    }
  }

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
  }

  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true)
      try {
        const startDate = format(startOfMonth(currentDate), "yyyy-MM-dd")
        const endDate = format(endOfMonth(currentDate), "yyyy-MM-dd")
        
        let url = `/api/appointments?start_date=${startDate}&end_date=${endDate}`
        if (selectedSalon !== "all") {
          url += `&salon_id=${selectedSalon}`
        }

        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setAppointments(data)
        }
      } catch (error) {
        console.error("Erreur lors du chargement des rendez-vous:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchAppointments()
  }, [currentDate, selectedSalon])

  // Generate calendar grid including previous/next month days for complete weeks
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  })

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(appointment => 
      isSameDay(new Date(appointment.start_time), day)
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800 border-green-200"
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed": return "bg-blue-100 text-blue-800 border-blue-200"
      case "cancelled": return "bg-red-100 text-red-800 border-red-200"
      case "no_show": return "bg-gray-100 text-gray-800 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed": return "Confirmé"
      case "pending": return "En attente"
      case "completed": return "Terminé"
      case "cancelled": return "Annulé"
      case "no_show": return "Absent"
      default: return status
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendrier des Rendez-vous</h1>
      </div>

      {/* Salon Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Filtrer par salon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedSalon} onValueChange={setSelectedSalon}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Sélectionner un salon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les salons</SelectItem>
              {salons.map((salon) => (
                <SelectItem key={salon.id} value={salon.id}>
                  {salon.name} - {salon.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* View Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "month" | "week" | "day")}>
              <TabsList>
                <TabsTrigger value="month">Mois</TabsTrigger>
                <TabsTrigger value="week">Semaine</TabsTrigger>
                <TabsTrigger value="day">Jour</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date())}
            >
              Aujourd'hui
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="capitalize">
              {viewMode === "month" && format(currentDate, "MMMM yyyy", { locale: fr })}
              {viewMode === "week" && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: fr })}`}
              {viewMode === "day" && format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Chargement des rendez-vous...</div>
          ) : (
            <>
              {viewMode === "month" && (
                <div className="grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((day) => (
                    <div key={day} className="p-3 text-center font-semibold text-muted-foreground bg-muted/50 rounded-t">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {calendarDays.map((day) => {
                    const dayAppointments = getAppointmentsForDay(day)
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isToday = isSameDay(day, new Date())
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[140px] p-2 border border-border ${
                          isCurrentMonth ? "bg-background" : "bg-muted/30"
                        } ${isToday ? "ring-2 ring-primary" : ""}`}
                      >
                        <div className={`text-sm font-medium mb-2 ${
                          isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                        } ${isToday ? "text-primary font-bold" : ""}`}>
                          {format(day, "d")}
                        </div>
                        <div className="space-y-1">
                          {dayAppointments.slice(0, 4).map((appointment) => (
                            <div
                              key={appointment.id}
                              className={`text-xs p-1.5 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(appointment.status)}`}
                              onClick={() => handleAppointmentClick(appointment)}
                              title={`${format(new Date(appointment.start_time), "HH:mm")} - ${appointment.client.first_name} ${appointment.client.last_name}
Service: ${appointment.service.name}
Staff: ${appointment.staff.first_name} ${appointment.staff.last_name}
Salon: ${appointment.salon.name}
Statut: ${getStatusLabel(appointment.status)}`}
                            >
                              <div className="font-medium">
                                {format(new Date(appointment.start_time), "HH:mm")}
                              </div>
                              <div className="truncate">
                                {appointment.client.first_name} {appointment.client.last_name}
                              </div>
                              <div className="truncate text-xs opacity-75">
                                {appointment.service.name}
                              </div>
                            </div>
                          ))}
                          {dayAppointments.length > 4 && (
                            <div className="text-xs text-muted-foreground font-medium">
                              +{dayAppointments.length - 4} autres
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {viewMode === "week" && (
                <WeekView 
                  currentDate={currentDate} 
                  appointments={appointments} 
                  onAppointmentClick={handleAppointmentClick}
                />
              )}

              {viewMode === "day" && (
                <DayView 
                  currentDate={currentDate} 
                  appointments={appointments} 
                  onAppointmentClick={handleAppointmentClick}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rendez-vous</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointments.length}</div>
            <p className="text-xs text-muted-foreground">
              {format(currentDate, "MMMM yyyy", { locale: fr })}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {appointments.filter(a => a.status === "confirmed").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Rendez-vous confirmés
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {appointments.filter(a => a.status === "pending").length}
            </div>
            <p className="text-xs text-muted-foreground">
              À confirmer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Légende des statuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["confirmed", "pending", "completed", "cancelled", "no_show"].map((status) => (
              <Badge key={status} variant="outline" className={getStatusColor(status)}>
                {getStatusLabel(status)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        appointment={selectedAppointment}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}