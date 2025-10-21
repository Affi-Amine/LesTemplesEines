"use client"

import { AdminHeader } from "@/components/admin-header"
import { StatCard } from "@/components/stat-card"
import { AppointmentsTable } from "@/components/appointments-table"
import { appointments, clients } from "@/lib/mock-data"
import { Calendar, Users, TrendingUp, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function AdminDashboard() {
  const { t, mounted } = useTranslations()
  const upcomingAppointments = appointments.slice(0, 5)
  const totalRevenue = appointments.reduce((sum) => sum + 89, 0) // Mock calculation

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.dashboard")} description="Bienvenue! Voici l'aperçu de votre activité." />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title={t("admin.total_appointments")}
            value={appointments.length}
            description="Ce mois"
            icon={Calendar}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title={t("admin.total_clients")}
            value={clients.length}
            description="Clients actifs"
            icon={Users}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title={t("admin.total_revenue")}
            value={`€${totalRevenue}`}
            description="Ce mois"
            icon={TrendingUp}
            trend={{ value: 15, isPositive: true }}
          />
          <StatCard
            title={t("admin.pending_bookings")}
            value={appointments.filter((a) => a.status === "pending").length}
            description="En attente de confirmation"
            icon={Clock}
            trend={{ value: 3, isPositive: false }}
          />
        </div>

        {/* Upcoming Appointments */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Rendez-vous à venir</h2>
          <AppointmentsTable
            appointments={upcomingAppointments.map((apt) => ({
              id: apt.id,
              clientName: apt.clientName,
              service: "Massage Relaxant", // Mock
              date: apt.date,
              time: apt.time,
              status: apt.status as "confirmed" | "pending" | "cancelled",
              therapist: "Sophie Martin", // Mock
            }))}
          />
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Services les plus populaires</h3>
            <div className="space-y-3">
              {[
                { name: "Massage Relaxant", count: 12 },
                { name: "Massage Sportif", count: 8 },
                { name: "Soin du Visage", count: 6 },
              ].map((service) => (
                <div key={service.name} className="flex justify-between items-center">
                  <span className="text-sm">{service.name}</span>
                  <span className="font-semibold">{service.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Performance des salons</h3>
            <div className="space-y-3">
              {[
                { name: "Paris", bookings: 24 },
                { name: "Lyon", bookings: 18 },
                { name: "Marseille", bookings: 15 },
              ].map((salon) => (
                <div key={salon.name} className="flex justify-between items-center">
                  <span className="text-sm">{salon.name}</span>
                  <span className="font-semibold">{salon.bookings}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
