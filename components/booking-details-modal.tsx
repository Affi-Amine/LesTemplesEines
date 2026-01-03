"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, User, MapPin, Scissors, Phone, Mail, FileText, Edit, Trash2, X } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"

interface BookingDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onRefetch?: () => void
  appointment: {
    id: string
    start_time: string
    end_time: string
    status: string
    client_notes?: string
    salon_id?: string
    service_id?: string
    staff_id?: string
    assignments?: any[]
    client: {
      first_name: string
      last_name: string
      phone?: string
      email?: string
    }
    staff: {
      id?: string
      first_name: string
      last_name: string
      role?: string
      phone?: string
    }
    service: {
      id?: string
      name: string
      duration?: number
      price?: number
    }
    salon: {
      id?: string
      name: string
      address?: string
      city?: string
      phone?: string
    }
  } | null
}

export function BookingDetailsModal({ isOpen, onClose, onRefetch, appointment }: BookingDetailsModalProps) {
  const router = useRouter()
  const [isEditMode, setIsEditMode] = useState(false)
  const [editForm, setEditForm] = useState({
    salon_id: "",
    service_id: "",
    staff_ids: [] as string[],
    date: "",
    time: "",
    status: "",
    notes: "",
  })

  // Fetch salons
  const { data: salons } = useQuery({
    queryKey: ["salons"],
    queryFn: () => fetchAPI<any[]>("/salons"),
  })

  // Fetch services for selected salon
  const { data: services } = useQuery({
    queryKey: ["services", editForm.salon_id],
    queryFn: () => fetchAPI<any[]>(`/services?salon_id=${editForm.salon_id}`),
    enabled: !!editForm.salon_id,
  })

  // Fetch staff for selected salon
  const { data: staff } = useQuery({
    queryKey: ["staff", editForm.salon_id],
    queryFn: () => fetchAPI<any[]>(`/staff?salon_id=${editForm.salon_id}`),
    enabled: !!editForm.salon_id,
  })

  // Initialize edit form when appointment changes or edit mode is activated
  useEffect(() => {
    if (appointment && isEditMode) {
      const staffIds: string[] = []
      if (appointment.staff?.id) {
        staffIds.push(appointment.staff.id)
      }
      if (appointment.assignments) {
        appointment.assignments.forEach((a: any) => {
          if (a.staff?.id && !staffIds.includes(a.staff.id)) {
            staffIds.push(a.staff.id)
          }
        })
      }

      setEditForm({
        salon_id: appointment.salon_id || appointment.salon?.id || "",
        service_id: appointment.service_id || appointment.service?.id || "",
        staff_ids: staffIds,
        date: formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd"),
        time: formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm"),
        status: appointment.status,
        notes: appointment.client_notes || "",
      })
    }
  }, [appointment, isEditMode])

  if (!appointment) return null

  const handleEdit = () => {
    setIsEditMode(true)
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
  }

  const handleSaveEdit = async () => {
    try {
      // Construct start_time from date and time
      const parisTime = fromZonedTime(`${editForm.date} ${editForm.time}:00`, "Europe/Paris")
      const start_time = parisTime.toISOString()

      const response = await fetch(`/api/appointments/${appointment.id}`, {
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
        description: `Le rendez-vous a été mis à jour avec succès`,
      })

      setIsEditMode(false)
      onRefetch?.()
      onClose()
    } catch (error) {
      toast.error("Erreur lors de la mise à jour", {
        description: "Impossible de mettre à jour le rendez-vous",
      })
    }
  }

  const handleAddStaff = (staffId: string) => {
    if (!editForm.staff_ids.includes(staffId)) {
      setEditForm({ ...editForm, staff_ids: [...editForm.staff_ids, staffId] })
    }
  }

  const handleRemoveStaff = (staffId: string) => {
    setEditForm({ ...editForm, staff_ids: editForm.staff_ids.filter(id => id !== staffId) })
  }

  const handleCancelAppointment = async () => {
    if (!confirm("Êtes-vous sûr de vouloir annuler ce rendez-vous ?")) {
      return
    }

    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        throw new Error("Échec de l'annulation")
      }

      toast.success("Rendez-vous annulé", {
        description: "Le rendez-vous a été annulé avec succès.",
      })

      onRefetch?.()
      onClose()
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible d'annuler le rendez-vous. Veuillez réessayer.",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800 border-green-200"
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed": return "bg-blue-100 text-blue-800 border-blue-200"
      case "cancelled": return "bg-red-100 text-red-800 border-red-200"
      case "no_show": return "bg-gray-100 text-gray-800 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed": return "Confirmé"
      case "pending": return "En attente"
      case "completed": return "Terminé"
      case "cancelled": return "Annulé"
      case "no_show": return "Absent"
      default: return status
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
    }
    return `${mins}min`
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price)
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {
      setIsEditMode(false)
      onClose()
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isEditMode ? "Modifier le rendez-vous" : "Détails du Rendez-vous"}</span>
            {!isEditMode && (
              <Badge variant="outline" className={getStatusColor(appointment.status)}>
                {getStatusLabel(appointment.status)}
              </Badge>
            )}
          </DialogTitle>
          {isEditMode && (
            <DialogDescription>
              Modifier les détails du rendez-vous
            </DialogDescription>
          )}
        </DialogHeader>

        {isEditMode ? (
          /* Edit Mode */
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
              <Label htmlFor="edit-therapist">Thérapeutes</Label>
              <Select onValueChange={handleAddStaff} disabled={!editForm.salon_id}>
                <SelectTrigger>
                  <SelectValue placeholder="Ajouter un thérapeute" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.filter(m => !editForm.staff_ids.includes(m.id)).map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 mt-2">
                {editForm.staff_ids.map(id => {
                  const member = staff?.find(s => s.id === id)
                  if (!member) return null
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {member.first_name} {member.last_name}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveStaff(id)} />
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
                  <SelectItem value="in_progress">En cours</SelectItem>
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

            <DialogFooter>
              <Button variant="outline" onClick={handleCancelEdit}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} className="cursor-pointer">
                Enregistrer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* View Mode */

        <div className="space-y-6">
          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Date
              </div>
              <p className="text-lg font-semibold">
                {format(new Date(appointment.start_time), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="w-4 h-4" />
                Heure
              </div>
              <p className="text-lg font-semibold">
                {format(new Date(appointment.start_time), "HH:mm")} - {format(new Date(appointment.end_time), "HH:mm")}
              </p>
            </div>
          </div>

          <Separator />

          {/* Client Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="w-4 h-4" />
              Client
            </div>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-lg">
                {appointment.client.first_name} {appointment.client.last_name}
              </p>
              {appointment.client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4" />
                  <span>{appointment.client.phone}</span>
                </div>
              )}
              {appointment.client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4" />
                  <span>{appointment.client.email}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Staff Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="w-4 h-4" />
              Thérapeute
            </div>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-lg">
                {appointment.staff.first_name} {appointment.staff.last_name}
              </p>
              {appointment.staff.role && (
                <p className="text-sm text-muted-foreground">{appointment.staff.role}</p>
              )}
              {appointment.staff.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4" />
                  <span>{appointment.staff.phone}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Service Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Scissors className="w-4 h-4" />
              Service
            </div>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-lg">{appointment.service.name}</p>
              <div className="flex gap-4 text-sm">
                {appointment.service.duration && (
                  <span>Durée: {formatDuration(appointment.service.duration)}</span>
                )}
                {appointment.service.price && (
                  <span>Prix: {formatPrice(appointment.service.price)}</span>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Salon Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="w-4 h-4" />
              Salon
            </div>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-lg">{appointment.salon.name}</p>
              {appointment.salon.address && (
                <p className="text-sm">
                  {appointment.salon.address}
                  {appointment.salon.city && `, ${appointment.salon.city}`}
                </p>
              )}
              {appointment.salon.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4" />
                  <span>{appointment.salon.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Client Notes */}
          {appointment.client_notes && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  Notes du client
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">{appointment.client_notes}</p>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={handleEdit}
            >
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
            <Button
              variant="outline"
              className="flex-1 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleCancelAppointment}
              disabled={appointment.status === "cancelled"}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Annuler
            </Button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}