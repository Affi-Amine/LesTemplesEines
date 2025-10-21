"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { employees } from "@/lib/mock-data"
import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function StaffPage() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.staff")} description={t("admin.staff")} />

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("admin.staff")}</h2>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t("common.add")}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((emp) => (
            <Card key={emp.id} className="overflow-hidden">
              <div className="relative h-40 bg-muted">
                <Image
                  src={emp.photo || "/placeholder.svg?height=160&width=300&query=professional therapist"}
                  alt={emp.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{emp.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{emp.role}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {emp.specialties.slice(0, 2).map((spec) => (
                    <Badge key={spec} variant="secondary" className="text-xs">
                      {spec.replace("massage-", "").replace("-", " ")}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  {t("common.edit")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
