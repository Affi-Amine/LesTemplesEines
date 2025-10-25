"use client"

import { AdminHeader } from "@/components/admin-header"
import { AppointmentsTable } from "@/components/appointments-table"
import { Button } from "@/components/ui/button"
import { useAppointments } from "@/lib/hooks/use-appointments"
import { Plus } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function AppointmentsPage() {
  const { t } = useTranslations()
  const { data: appointments, isLoading } = useAppointments()

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.appointments")} description={t("admin.appointments")} />

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("admin.appointments")}</h2>
          <Button className="gap-2 cursor-pointer">
            <Plus className="w-4 h-4" />
            {t("common.add")}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : (
          <AppointmentsTable
            appointments={appointments?.map((apt: any) => ({
              id: apt.id,
              clientName: `${apt.client?.first_name || ''} ${apt.client?.last_name || ''}`.trim() || 'Client',
              service: apt.service?.name || 'Service',
              date: new Date(apt.start_time).toLocaleDateString('fr-FR'),
              time: new Date(apt.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              status: apt.status as "confirmed" | "pending" | "cancelled",
              therapist: apt.staff ? `${apt.staff.first_name} ${apt.staff.last_name}` : 'Thérapeute',
            })) || []}
          />
        )}
      </div>
    </div>
  )
}
