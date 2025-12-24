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
import { useMemo, useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Icon } from "@iconify/react"

interface Appointment {
  id: string
  clientName: string
  service: string
  salon: string
  date: string
  time: string
  status: "confirmed" | "cancelled" | "completed" | "no_show" | "blocked" | "in_progress"
  therapist: string
}

export default function AdminDashboard() {
  const { t, mounted } = useTranslations()
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem("user-storage")
    if (stored) {
      const parsed = JSON.parse(stored)
      setUserInfo(parsed.state?.userInfo)
    }
  }, [])

  const isAdmin = userInfo?.role === 'admin'
  
  // State for modals
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [editFormData, setEditFormData] = useState({
    status: "",
    notes: ""
  })

  // Fetch appointments
  const { data: appointments, isLoading: appointmentsLoading, refetch } = useAppointments()

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

  // Handle appointment actions
  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setViewDialogOpen(true)
  }

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setEditFormData({
      status: appointment.status,
      notes: ""
    })
    setEditDialogOpen(true)
  }

  const handleDeleteAppointment = async (appointment: Appointment) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le rendez-vous de ${appointment.clientName} ?`)) {
      return
    }

    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Échec de la suppression")
      }

      toast.success("Rendez-vous supprimé", {
        description: `Le rendez-vous de ${appointment.clientName} a été supprimé`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      refetch()
    } catch (error) {
      toast.error("Erreur lors de la suppression", {
        description: "Impossible de supprimer le rendez-vous",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedAppointment) return

    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: editFormData.status,
          notes: editFormData.notes,
        }),
      })

      if (!response.ok) {
        throw new Error("Échec de la mise à jour")
      }

      toast.success("Rendez-vous mis à jour", {
        description: `Le rendez-vous de ${selectedAppointment.clientName} a été mis à jour`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      setEditDialogOpen(false)
      refetch()
    } catch (error) {
      toast.error("Erreur lors de la mise à jour", {
        description: "Impossible de mettre à jour le rendez-vous",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.dashboard")} description="Bienvenue! Voici l'aperçu de votre activité." />

      <div className="p-6 space-y-6">
        {/* Stats Grid - Admin Only */}
        {isAdmin && (
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
        )}

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
              salon: apt.salon?.name || 'Salon',
              date: new Date(apt.start_time).toLocaleDateString('fr-FR'),
              time: new Date(apt.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              status: apt.status === "pending" ? "confirmed" : apt.status,
              therapist: apt.assignments?.length > 0 
                ? apt.assignments.map((a: any) => `${a.staff.first_name} ${a.staff.last_name}`).join(", ")
                : (apt.staff ? `${apt.staff.first_name} ${apt.staff.last_name}` : 'Thérapeute'),
            }))}
            onView={handleViewAppointment}
            onEdit={handleEditAppointment}
            onDelete={handleDeleteAppointment}
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

      {/* View Appointment Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Détails du rendez-vous</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Client</Label>
                <p className="text-sm font-medium">{selectedAppointment.clientName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Service</Label>
                <p className="text-sm">{selectedAppointment.service}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Salon</Label>
                <p className="text-sm">{selectedAppointment.salon}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Date et heure</Label>
                <p className="text-sm">{selectedAppointment.date} à {selectedAppointment.time}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Thérapeute</Label>
                <p className="text-sm">{selectedAppointment.therapist}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Statut</Label>
                <p className="text-sm capitalize">
                  {selectedAppointment.status === 'confirmed' && 'Confirmé'}
                  {selectedAppointment.status === 'cancelled' && 'Annulé'}
                  {selectedAppointment.status === 'completed' && 'Terminé'}
                  {selectedAppointment.status === 'in_progress' && 'En cours'}
                  {selectedAppointment.status === 'no_show' && 'No Show'}
                  {selectedAppointment.status === 'blocked' && 'Bloqué'}
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setViewDialogOpen(false)}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le rendez-vous</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Client</Label>
                <p className="text-sm font-medium">{selectedAppointment.clientName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Service</Label>
                <p className="text-sm">{selectedAppointment.service}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Date et heure</Label>
                <p className="text-sm">{selectedAppointment.date} à {selectedAppointment.time}</p>
              </div>
              <div>
                <Label htmlFor="status">Statut</Label>
                <Select value={editFormData.status} onValueChange={(value) => setEditFormData({...editFormData, status: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmé</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                    <SelectItem value="blocked">Bloqué</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Input
                  id="notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  placeholder="Ajouter des notes..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSaveEdit}>Sauvegarder</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
