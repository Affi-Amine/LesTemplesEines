"use client"

import { AdminHeader } from "@/components/admin-header"
import { AppointmentsTable } from "@/components/appointments-table"
import { Button } from "@/components/ui/button"
import { useAppointments } from "@/lib/hooks/use-appointments"
import { Plus, X } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
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
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { fromZonedTime, formatInTimeZone } from "date-fns-tz"

interface Appointment {
  id: string
  clientName: string
  service: string
  salon: string
  date: string
  time: string
  status: "confirmed" | "pending" | "cancelled"
  therapist: string
}

import { SalonFilter } from "@/components/salon-filter"

export default function AppointmentsPage() {
  const { t } = useTranslations()
  const [selectedSalonId, setSelectedSalonId] = useState("all")
  const { data: appointments, isLoading, refetch } = useAppointments({
    salonId: selectedSalonId === "all" ? undefined : selectedSalonId
  })


  // Create dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // View, Edit, Delete dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  
  const [form, setForm] = useState({
    salon_id: "",
    service_id: "",
    staff_id: "",
    staff_ids: [] as string[],
    date: "",
    time: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  })

  const [editForm, setEditForm] = useState({
    status: "",
    notes: "",
    salon_id: "",
    service_id: "",
    staff_ids: [] as string[],
    date: "",
    time: "",
  })

  const { data: salons } = useSalons()
  const { data: services } = useServices(form.salon_id || undefined)
  const { data: staff } = useStaff(form.salon_id || undefined)
  
  // Hooks for Edit Form
  const { data: editServices } = useServices(editForm.salon_id || undefined)
  const { data: editStaff } = useStaff(editForm.salon_id || undefined)

  const createAppointment = useCreateAppointment()

  const resetForm = () => {
    setForm({
      salon_id: "",
      service_id: "",
      staff_id: "",
      staff_ids: [],
      date: "",
      time: "",
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      notes: "",
    })
  }

  const handleAddStaff = (staffId: string) => {
    if (!form.staff_ids.includes(staffId)) {
      setForm({ ...form, staff_ids: [...form.staff_ids, staffId] })
    }
  }

  const handleRemoveStaff = (staffId: string) => {
    setForm({ ...form, staff_ids: form.staff_ids.filter(id => id !== staffId) })
  }

  // Edit Form Staff Handlers
  const handleEditAddStaff = (staffId: string) => {
    if (!editForm.staff_ids.includes(staffId)) {
      setEditForm({ ...editForm, staff_ids: [...editForm.staff_ids, staffId] })
    }
  }

  const handleEditRemoveStaff = (staffId: string) => {
    setEditForm({ ...editForm, staff_ids: editForm.staff_ids.filter(id => id !== staffId) })
  }

  useEffect(() => {
    if (createAppointment.isSuccess) {
      setIsDialogOpen(false)
      resetForm()
    }
  }, [createAppointment.isSuccess])

  const handleCreate = () => setIsDialogOpen(true)

  const handleSave = async () => {
    if (!form.salon_id || !form.service_id || (form.staff_ids.length === 0 && !form.staff_id) || !form.date || !form.time || !form.first_name || !form.last_name || !form.phone) {
      toast.error("Champs manquants", {
        description: "Veuillez remplir tous les champs obligatoires",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    // Convert Paris time to UTC ISO string
    const parisTime = fromZonedTime(`${form.date} ${form.time}:00`, "Europe/Paris")
    const start_time = parisTime.toISOString()

    // Handle backward compatibility and multi-select
    const primaryStaffId = form.staff_id || form.staff_ids[0]
    const allStaffIds = form.staff_ids.length > 0 ? form.staff_ids : (primaryStaffId ? [primaryStaffId] : [])

    createAppointment.mutate({
      salon_id: form.salon_id,
      service_id: form.service_id,
      staff_id: primaryStaffId,
      staff_ids: allStaffIds,
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

  // Handle appointment actions
  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setViewDialogOpen(true)
  }

  const handleEditAppointment = (appointment: Appointment) => {
    // Find full appointment details
    const fullAppointment: any = appointments?.find((a: any) => a.id === appointment.id)
    if (!fullAppointment) return

    setSelectedAppointment(appointment)
    
    // Extract date and time in Paris timezone
    const parisDate = formatInTimeZone(fullAppointment.start_time, "Europe/Paris", "yyyy-MM-dd")
    const parisTime = formatInTimeZone(fullAppointment.start_time, "Europe/Paris", "HH:mm")

    // Get staff IDs
    const staffIds = fullAppointment.assignments?.length > 0
      ? fullAppointment.assignments.map((a: any) => a.staff.id) 
      : (fullAppointment.staff_id ? [fullAppointment.staff_id] : [])

    setEditForm({
      status: appointment.status,
      notes: fullAppointment.client_notes || "",
      salon_id: fullAppointment.salon_id,
      service_id: fullAppointment.service_id,
      staff_ids: staffIds,
      date: parisDate,
      time: parisTime,
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
      // Construct start_time from date and time
      const parisTime = fromZonedTime(`${editForm.date} ${editForm.time}:00`, "Europe/Paris")
      const start_time = parisTime.toISOString()

      const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: editForm.status,
          client_notes: editForm.notes,
          salon_id: editForm.salon_id,
          service_id: editForm.service_id,
          staff_ids: editForm.staff_ids,
          start_time: start_time,
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

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Rendez-vous" description="Gérer les rendez-vous du salon" />
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Rendez-vous</h1>
          <div className="flex items-center gap-4">
            <SalonFilter selectedSalonId={selectedSalonId} onSelectSalon={setSelectedSalonId} />
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nouveau rendez-vous
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : (
          <AppointmentsTable 
            appointments={appointments?.map((apt: any) => ({
              id: apt.id,
              clientName: `${apt.client?.first_name || ''} ${apt.client?.last_name || ''}`.trim() || 'Client',
              service: apt.service?.name || 'Service',
              salon: apt.salon?.name || 'Salon',
              date: formatInTimeZone(apt.start_time, "Europe/Paris", "dd/MM/yyyy", { locale: fr }),
              time: formatInTimeZone(apt.start_time, "Europe/Paris", "HH:mm"),
              status: apt.status as "confirmed" | "pending" | "cancelled",
              therapist: apt.assignments?.length > 0 
                ? apt.assignments.map((a: any) => `${a.staff.first_name} ${a.staff.last_name}`).join(", ")
                : (apt.staff ? `${apt.staff.first_name} ${apt.staff.last_name}` : 'Thérapeute'),
            })) || []} 
            onView={handleViewAppointment}
            onEdit={handleEditAppointment}
            onDelete={handleDeleteAppointment}
          />
        )}

        {/* Create Appointment Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Nouveau rendez-vous</DialogTitle>
              <DialogDescription>
                Créer un nouveau rendez-vous pour un client.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salon">Salon</Label>
                  <Select value={form.salon_id} onValueChange={(value) => setForm({ ...form, salon_id: value, service_id: "", staff_id: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un salon" />
                    </SelectTrigger>
                    <SelectContent>
                      {salons?.map((salon) => (
                        <SelectItem key={salon.id} value={salon.id}>
                          {salon.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service">Service</Label>
                  <Select value={form.service_id} onValueChange={(value) => setForm({ ...form, service_id: value })} disabled={!form.salon_id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services?.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="therapist">Thérapeutes</Label>
                <Select onValueChange={handleAddStaff} disabled={!form.salon_id}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ajouter un thérapeute" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff?.filter(m => !form.staff_ids.includes(m.id)).map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.staff_ids.map(id => {
                    const member = staff?.find(s => s.id === id)
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {member?.first_name} {member?.last_name}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveStaff(id)} />
                      </Badge>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Heure</Label>
                  <Input
                    id="time"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input
                    id="phone"
                    placeholder="Numéro de téléphone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    placeholder="Prénom du client"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    placeholder="Nom du client"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Adresse e-mail"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Notes supplémentaires"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={createAppointment.isPending}>
                {createAppointment.isPending ? "Sauvegarde..." : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Appointment Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Détails du rendez-vous</DialogTitle>
              <DialogDescription>
                Informations complètes du rendez-vous
              </DialogDescription>
            </DialogHeader>
            {selectedAppointment && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Client</Label>
                    <p className="text-sm">{selectedAppointment.clientName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Service</Label>
                    <p className="text-sm">{selectedAppointment.service}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Salon</Label>
                    <p className="text-sm">{selectedAppointment.salon}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Thérapeute</Label>
                    <p className="text-sm">{selectedAppointment.therapist}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Date</Label>
                    <p className="text-sm">{selectedAppointment.date}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Heure</Label>
                    <p className="text-sm">{selectedAppointment.time}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Statut</Label>
                  <p className="text-sm">
                    {selectedAppointment.status === "confirmed" && "Confirmé"}
                    {selectedAppointment.status === "pending" && "En attente"}
                    {selectedAppointment.status === "cancelled" && "Annulé"}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Appointment Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Modifier le rendez-vous</DialogTitle>
              <DialogDescription>
                Modifier les détails du rendez-vous
              </DialogDescription>
            </DialogHeader>
            {selectedAppointment && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-salon">Salon</Label>
                    <Select value={editForm.salon_id} onValueChange={(value) => setEditForm({ ...editForm, salon_id: value, service_id: "", staff_ids: [] })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un salon" />
                      </SelectTrigger>
                      <SelectContent>
                        {salons?.map((salon) => (
                          <SelectItem key={salon.id} value={salon.id}>
                            {salon.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-service">Service</Label>
                    <Select value={editForm.service_id} onValueChange={(value) => setEditForm({ ...editForm, service_id: value })} disabled={!editForm.salon_id}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un service" />
                      </SelectTrigger>
                      <SelectContent>
                        {editServices?.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-therapist">Thérapeutes</Label>
                  <Select onValueChange={handleEditAddStaff} disabled={!editForm.salon_id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ajouter un thérapeute" />
                    </SelectTrigger>
                    <SelectContent>
                      {editStaff?.filter(m => !editForm.staff_ids.includes(m.id)).map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.first_name} {member.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editForm.staff_ids.map(id => {
                      const member = editStaff?.find(s => s.id === id)
                      if (!member) return null 
                      return (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {member.first_name} {member.last_name}
                          <X className="w-3 h-3 cursor-pointer" onClick={() => handleEditRemoveStaff(id)} />
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-time">Heure</Label>
                    <Input
                      id="edit-time"
                      type="time"
                      value={editForm.time}
                      onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-status">Statut</Label>
                  <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="no_show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Input
                    id="edit-notes"
                    placeholder="Notes supplémentaires"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
