"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Calendar, Clock, User } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useServices } from "@/lib/hooks/use-services"
import { useStaff } from "@/lib/hooks/use-staff"
import { useCreateAppointment } from "@/lib/hooks/use-create-appointment"
import { toast } from "sonner"

interface QuickCreateModalProps {
  isOpen: boolean
  onClose: () => void
  salonId: string
  prefillData?: {
    date: Date
    hour: number
    minute: number
    staffId?: string
  }
  onSuccess?: () => void
}

export function QuickCreateModal({
  isOpen,
  onClose,
  salonId,
  prefillData,
  onSuccess,
}: QuickCreateModalProps) {
  const { data: services } = useServices(salonId)
  const { data: staff } = useStaff(salonId)
  const createAppointment = useCreateAppointment()

  const [form, setForm] = useState({
    service_id: "",
    staff_ids: [] as string[],
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  })

  // Reset form and prefill when modal opens
  useEffect(() => {
    if (isOpen && prefillData?.staffId) {
      setForm((prev) => ({
        ...prev,
        staff_ids: [prefillData.staffId!],
      }))
    } else if (!isOpen) {
      setForm({
        service_id: "",
        staff_ids: [],
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        notes: "",
      })
    }
  }, [isOpen, prefillData?.staffId])

  const toggleStaffSelection = (staffId: string) => {
    const current = form.staff_ids
    if (current.includes(staffId)) {
      setForm({ ...form, staff_ids: current.filter((id) => id !== staffId) })
    } else {
      setForm({ ...form, staff_ids: [...current, staffId] })
    }
  }

  const handleSubmit = async () => {
    if (!prefillData || form.staff_ids.length === 0 || !form.service_id || !form.first_name || !form.last_name || !form.phone) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    // Build start time from prefilled data
    const startDateTime = new Date(prefillData.date)
    startDateTime.setHours(prefillData.hour, prefillData.minute, 0, 0)

    createAppointment.mutate(
      {
        salon_id: salonId,
        service_id: form.service_id,
        staff_ids: form.staff_ids,
        staff_id: form.staff_ids[0],
        start_time: startDateTime.toISOString(),
        client_data: {
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          email: form.email || undefined,
        },
        client_notes: form.notes,
        status: "confirmed",
      },
      {
        onSuccess: () => {
          onClose()
          onSuccess?.()
        },
      }
    )
  }

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Nouveau rendez-vous rapide
          </DialogTitle>
          <DialogDescription>
            Créer un rendez-vous pour le créneau sélectionné
          </DialogDescription>
        </DialogHeader>

        {prefillData && (
          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">
                {format(prefillData.date, "EEEE d MMMM yyyy", { locale: fr })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">
                {formatTime(prefillData.hour, prefillData.minute)}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label>Service *</Label>
            <Select
              value={form.service_id}
              onValueChange={(val) => setForm({ ...form, service_id: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un service" />
              </SelectTrigger>
              <SelectContent>
                {services?.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} min) - {service.price_cents / 100}€
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Staff Selection */}
          <div className="space-y-2">
            <Label>Prestataire(s) *</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.staff_ids.map((id) => {
                const member = staff?.find((s) => s.id === id)
                return (
                  <Badge key={id} variant="secondary" className="gap-1 flex items-center p-2">
                    <span>
                      {member?.first_name} {member?.last_name}
                    </span>
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive ml-1"
                      onClick={() => toggleStaffSelection(id)}
                    />
                  </Badge>
                )
              })}
            </div>
            <Select onValueChange={(val) => toggleStaffSelection(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Ajouter un prestataire" />
              </SelectTrigger>
              <SelectContent>
                {staff
                  ?.filter((s) => !form.staff_ids.includes(s.id))
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client Information */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Informations client
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prénom *</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Prénom"
              />
            </div>
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Nom"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Téléphone *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="06..."
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="client@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Notes sur le rendez-vous..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createAppointment.isPending}
            className="cursor-pointer"
          >
            {createAppointment.isPending ? "Création..." : "Créer le rendez-vous"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
