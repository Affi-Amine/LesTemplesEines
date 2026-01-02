"use client"

import { StatCard } from "@/components/stat-card"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, TrendingUp, Eye } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toZonedTime, formatInTimeZone } from "date-fns-tz"

export default function EmployeeDashboard() {
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    // Get user info from localStorage
    const adminUser = localStorage.getItem("adminUser")
    if (adminUser) {
      setUserInfo(JSON.parse(adminUser))
    }
  }, [])

  // Fetch appointments for this staff member
  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ["staff-appointments", userInfo?.id],
    queryFn: async () => {
      if (!userInfo?.id) {
        console.warn("No user ID available for fetching appointments")
        return []
      }
      try {
        return await fetchAPI<any[]>(`/staff/${userInfo.id}/appointments`)
      } catch (error) {
        console.error("Error fetching staff appointments:", error)
        return []
      }
    },
    enabled: !!userInfo?.id,
    retry: 1,
    staleTime: 30000, // 30 seconds
  })

  // Calculate today's statistics
  const todayStats = useMemo(() => {
    if (!appointments) return {
      todayAppointments: [],
      upcomingAppointments: [],
      totalToday: 0,
      completedToday: 0,
      revenueToday: 0
    }

    const now = new Date()
    const nowParis = toZonedTime(now, "Europe/Paris")
    const todayStr = formatInTimeZone(now, "Europe/Paris", "yyyy-MM-dd")

    const todayAppointments = appointments.filter((apt: any) => {
      const aptDateStr = formatInTimeZone(apt.start_time, "Europe/Paris", "yyyy-MM-dd")
      return aptDateStr === todayStr
    })

    const upcomingAppointments = appointments.filter((apt: any) => {
      const aptDate = new Date(apt.start_time) // UTC comparison is fine for "upcoming" relative to "now"
      return aptDate > now && formatInTimeZone(apt.start_time, "Europe/Paris", "yyyy-MM-dd") === todayStr
    }).sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    const completedToday = todayAppointments.filter((apt: any) => 
      apt.status === 'completed' || new Date(apt.end_time) < now
    ).length

    const revenueToday = todayAppointments
      .filter((apt: any) => apt?.status === 'completed')
      .reduce((sum: number, apt: any) => sum + (apt?.services?.price_cents || apt?.service?.price_cents || 0), 0)

    return {
      todayAppointments,
      upcomingAppointments: upcomingAppointments.slice(0, 5), // Next 5 appointments
      totalToday: todayAppointments.length,
      completedToday,
      revenueToday: revenueToday / 100 // Convert cents to euros
    }
  }, [appointments])

  const formatTime = (dateString: string) => {
    return formatInTimeZone(dateString, "Europe/Paris", "HH:mm")
  }

  const formatDate = (dateString: string) => {
    return formatInTimeZone(dateString, "Europe/Paris", "EEEE d MMMM yyyy", { locale: fr })
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/20 rounded-full animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de votre planning...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Bonjour {userInfo?.first_name} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/employee/calendar">
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Voir le calendrier
            </Button>
          </Link>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Rendez-vous aujourd'hui"
          value={todayStats.totalToday.toString()}
          icon={Calendar}
        />
        <StatCard
          title="Terminés"
          value={todayStats.completedToday.toString()}
          icon={Clock}
        />
        <StatCard
          title="Revenus du jour"
          value={`${todayStats.revenueToday.toFixed(2)}€`}
          icon={TrendingUp}
        />
        <StatCard
          title="À venir"
          value={(todayStats.totalToday - todayStats.completedToday).toString()}
          icon={Users}
        />
      </div>

      {/* Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Prochains rendez-vous</h2>
            <Link href="/employee/calendar">
              <Button variant="ghost" size="sm" className="gap-2">
                <Eye className="h-4 w-4" />
                Voir tout
              </Button>
            </Link>
          </div>
          
          {todayStats.upcomingAppointments.length > 0 ? (
            <div className="space-y-3">
              {todayStats.upcomingAppointments.map((appointment: any) => {
                // Safety checks for appointment data
                if (!appointment?.id) return null

                const clientName = `${appointment.clients?.first_name || appointment.client?.first_name || ''} ${appointment.clients?.last_name || appointment.client?.last_name || 'Client'}`.trim()
                const serviceName = appointment.services?.name || appointment.service?.name || 'Service'

                return (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          appointment.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {appointment.status === 'confirmed' ? 'Confirmé' : 'En attente'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {clientName}
                      </p>
                      <p className="text-sm font-medium">
                        {serviceName}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun rendez-vous à venir aujourd'hui</p>
            </div>
          )}
        </Card>

        {/* Today's Summary */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Résumé du jour</h2>
          
          {todayStats.todayAppointments.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-primary/5 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {todayStats.totalToday}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total rendez-vous
                  </div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {todayStats.completedToday}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Terminés
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Revenus du jour</span>
                  <span className="font-semibold text-lg">
                    {todayStats.revenueToday.toFixed(2)}€
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun rendez-vous programmé aujourd'hui</p>
              <p className="text-sm mt-1">Profitez de cette journée libre !</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}