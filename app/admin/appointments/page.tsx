"use client"

import { AdminHeader } from "@/components/admin-header"
import { AppointmentsTable } from "@/components/appointments-table"
import { Button } from "@/components/ui/button"
import { appointments } from "@/lib/mock-data"
import { Plus } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function AppointmentsPage() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.appointments")} description={t("admin.appointments")} />

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("admin.appointments")}</h2>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t("common.add")}
          </Button>
        </div>

        <AppointmentsTable
          appointments={appointments.map((apt) => ({
            id: apt.id,
            clientName: apt.clientName,
            service: "Massage Relaxant",
            date: apt.date,
            time: apt.time,
            status: apt.status as "confirmed" | "pending" | "cancelled",
            therapist: "Sophie Martin",
          }))}
        />
      </div>
    </div>
  )
}
