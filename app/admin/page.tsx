"use client"

import { AdminHeader } from "@/components/admin-header"
import { StatCard } from "@/components/stat-card"
import { AppointmentsTable } from "@/components/appointments-table"
import { useAppointments } from "@/lib/hooks/use-appointments"
import { Calendar, Users, TrendingUp, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"
import { fetchAPI } from "@/lib/api/client"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

export default function AdminDashboard() {
  const { t, mounted } = useTranslations()

  // Fetch appointments
  const { data: appointments, isLoading: appointmentsLoading } = useAppointments()

  // Fetch clients count
  const { data: clientsData } = useQuery({
    queryKey: ["clients-count"],
    queryFn: () => fetchAPI<any[]>("/clients"),
  })

  // Calculate statistics
  const stats = useMemo(() => {
    if (!appointments) return {
      thisMonth: 0,
      lastMonth: 0,
      revenue: 0,
      revenueLastMonth: 0,
      pending: 0,
      pendingLastMonth: 0,
      clientsThisMonth: 0,
      clientsLastMonth: 0
    }

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    const thisMonthAppointments = appointments.filter((apt: any) => {
      const aptDate = new Date(apt.start_time)
      return aptDate >= thisMonthStart
    })

    const lastMonthAppointments = appointments.filter((apt: any) => {
      const aptDate = new Date(apt.start_time)
      return aptDate >= lastMonthStart && aptDate <= lastMonthEnd
    })

    const revenue = thisMonthAppointments.reduce((sum: number, apt: any) => {
      return sum + (apt.service?.price_cents || 0)
    }, 0) / 100

    const revenueLastMonth = lastMonthAppointments.reduce((sum: number, apt: any) => {
      return sum + (apt.service?.price_cents || 0)
    }, 0) / 100

    const pending = appointments.filter((apt: any) => apt.status === 'pending').length
    const pendingLastMonth = lastMonthAppointments.filter((apt: any) => apt.status === 'pending').length

    // Calculate unique clients this month and last month
    const clientsThisMonth = new Set(thisMonthAppointments.map((apt: any) => apt.client_id)).size
    const clientsLastMonth = new Set(lastMonthAppointments.map((apt: any) => apt.client_id)).size

    return {
      thisMonth: thisMonthAppointments.length,
      lastMonth: lastMonthAppointments.length,
      revenue,
      revenueLastMonth,
      pending,
      pendingLastMonth,
      clientsThisMonth,
      clientsLastMonth
    }
  }, [appointments])

  // Calculate trends
  const appointmentTrend = stats.lastMonth > 0
    ? Math.round(((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100)
    : 0

  const clientTrend = stats.clientsLastMonth > 0
    ? Math.round(((stats.clientsThisMonth - stats.clientsLastMonth) / stats.clientsLastMonth) * 100)
    : 0

  const revenueTrend = stats.revenueLastMonth > 0
    ? Math.round(((stats.revenue - stats.revenueLastMonth) / stats.revenueLastMonth) * 100)
    : 0

  const pendingTrend = stats.pendingLastMonth > 0
    ? Math.round(((stats.pending - stats.pendingLastMonth) / stats.pendingLastMonth) * 100)
    : 0

  const upcomingAppointments = appointments?.slice(0, 5) || []

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.dashboard")} description="Bienvenue! Voici l'aperçu de votre activité." />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title={t("admin.total_appointments")}
            value={appointmentsLoading ? "..." : stats.thisMonth}
            description="Ce mois"
            icon={Calendar}
            trend={appointmentTrend !== 0 ? { value: Math.abs(appointmentTrend), isPositive: appointmentTrend > 0 } : undefined}
          />
          <StatCard
            title={t("admin.total_clients")}
            value={appointmentsLoading ? "..." : stats.clientsThisMonth}
            description="Nouveaux ce mois"
            icon={Users}
            trend={clientTrend !== 0 ? { value: Math.abs(clientTrend), isPositive: clientTrend > 0 } : undefined}
          />
          <StatCard
            title={t("admin.total_revenue")}
            value={appointmentsLoading ? "..." : `€${stats.revenue.toFixed(2)}`}
            description="Ce mois"
            icon={TrendingUp}
            trend={revenueTrend !== 0 ? { value: Math.abs(revenueTrend), isPositive: revenueTrend > 0 } : undefined}
          />
          <StatCard
            title={t("admin.pending_bookings")}
            value={appointmentsLoading ? "..." : stats.pending}
            description="En attente de confirmation"
            icon={Clock}
            trend={pendingTrend !== 0 ? { value: Math.abs(pendingTrend), isPositive: pendingTrend < 0 } : undefined}
          />
        </div>

        {/* Upcoming Appointments */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Rendez-vous à venir</h2>
          {appointmentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : (
            <AppointmentsTable
              appointments={upcomingAppointments.map((apt: any) => ({
                id: apt.id,
                clientName: `${apt.client?.first_name || ''} ${apt.client?.last_name || ''}`.trim() || 'Client',
                service: apt.service?.name || 'Service',
                date: new Date(apt.start_time).toLocaleDateString('fr-FR'),
                time: new Date(apt.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                status: apt.status as "confirmed" | "pending" | "cancelled",
                therapist: apt.staff ? `${apt.staff.first_name} ${apt.staff.last_name}` : 'Thérapeute',
              }))}
            />
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Services les plus populaires</h3>
            <div className="space-y-3">
              {appointmentsLoading ? (
                <div className="text-sm text-muted-foreground">Chargement...</div>
              ) : (
                (() => {
                  const serviceCount = appointments?.reduce((acc: Record<string, { name: string; count: number }>, apt: any) => {
                    const serviceName = apt.service?.name || 'Service inconnu'
                    if (!acc[serviceName]) {
                      acc[serviceName] = { name: serviceName, count: 0 }
                    }
                    acc[serviceName].count++
                    return acc
                  }, {})

                  const topServices = Object.values(serviceCount || {})
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3)

                  return topServices.length > 0 ? (
                    topServices.map((service: any) => (
                      <div key={service.name} className="flex justify-between items-center">
                        <span className="text-sm">{service.name}</span>
                        <span className="font-semibold">{service.count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Aucune donnée disponible</div>
                  )
                })()
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Performance des salons</h3>
            <div className="space-y-3">
              {appointmentsLoading ? (
                <div className="text-sm text-muted-foreground">Chargement...</div>
              ) : (
                (() => {
                  const salonCount = appointments?.reduce((acc: Record<string, { name: string; bookings: number }>, apt: any) => {
                    const salonId = apt.salon_id
                    const salonName = apt.salon?.name || apt.salon?.city || 'Salon inconnu'
                    if (!acc[salonId]) {
                      acc[salonId] = { name: salonName, bookings: 0 }
                    }
                    acc[salonId].bookings++
                    return acc
                  }, {})

                  const salons = Object.values(salonCount || {})
                    .sort((a, b) => b.bookings - a.bookings)

                  return salons.length > 0 ? (
                    salons.map((salon: any) => (
                      <div key={salon.name} className="flex justify-between items-center">
                        <span className="text-sm">{salon.name}</span>
                        <span className="font-semibold">{salon.bookings}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Aucune donnée disponible</div>
                  )
                })()
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
