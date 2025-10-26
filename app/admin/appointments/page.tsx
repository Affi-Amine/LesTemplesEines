"use client"

import { AdminHeader } from "@/components/admin-header"
import { AppointmentsTable } from "@/components/appointments-table"
import { Button } from "@/components/ui/button"
import { useAppointments } from "@/lib/hooks/use-appointments"
import { Plus } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSalons } from "@/lib/hooks/use-salons"
import { useServices } from "@/lib/hooks/use-services"
import { useStaff } from "@/lib/hooks/use-staff"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { toast } from "sonner"
import { Icon } from "@iconify/react"

export default function AppointmentsPage() {
  const { t } = useTranslations()
  const { data: appointments, isLoading } = useAppointments()

  // Create dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState({
    salon_id: "",
    service_id: "",
    staff_id: "",
    date: "",
    time: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  })

  const { data: salons } = useSalons()
  const { data: services } = useServices(form.salon_id || undefined)
  const { data: staff } = useStaff(form.salon_id || undefined)
  const createAppointment = useCreateAppointment()

  const resetForm = () => {
    setForm({
      salon_id: "",
      service_id: "",
      staff_id: "",
      date: "",
      time: "",
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      notes: "",
    })
  }

  useEffect(() => {
    if (createAppointment.isSuccess) {
      setIsDialogOpen(false)
      resetForm()
    }
  }, [createAppointment.isSuccess])

  const handleCreate = () => setIsDialogOpen(true)

  const handleSave = async () => {
    if (!form.salon_id || !form.service_id || !form.staff_id || !form.date || !form.time || !form.first_name || !form.last_name || !form.phone) {
      toast.error("Champs manquants", {
        description: "Veuillez remplir tous les champs obligatoires",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    const start_time = `${form.date}T${form.time}:00Z`

    createAppointment.mutate({
      salon_id: form.salon_id,
      service_id: form.service_id,
      staff_id: form.staff_id,
      start_time,
      client_data: {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        email: form.email || undefined,
      },
      client_notes: form.notes || undefined,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.appointments")} description={t("admin.appointments")} />

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("admin.appointments")}</h2>
          <Button className="gap-2 cursor-pointer" onClick={handleCreate}>
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

      {/* Create Appointment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau rendez-vous</DialogTitle>
            <DialogDescription>Créer un rendez-vous pour un client</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Salon *</Label>
                <Select value={form.salon_id} onValueChange={(v) => setForm({ ...form, salon_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un salon" />
                  </SelectTrigger>
                  <SelectContent>
                    {salons?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service *</Label>
                <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services?.map((svc: any) => (
                      <SelectItem key={svc.id} value={svc.id}>
                        {svc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Thérapeute *</Label>
                <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un thérapeute" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff?.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.first_name} {e.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heure *</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+33612345678" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="cursor-pointer">
              Annuler
            </Button>
            <Button onClick={handleSave} className="cursor-pointer">
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
