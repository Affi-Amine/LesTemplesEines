"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, User, MapPin, Scissors, Phone, Mail, FileText, Edit, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface BookingDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: {
    id: string
    start_time: string
    end_time: string
    status: string
    client_notes?: string
    client: {
      first_name: string
      last_name: string
      phone?: string
      email?: string
    }
    staff: {
      first_name: string
      last_name: string
      role?: string
      phone?: string
    }
    service: {
      name: string
      duration?: number
      price?: number
    }
    salon: {
      name: string
      address?: string
      city?: string
      phone?: string
    }
  } | null
}

export function BookingDetailsModal({ isOpen, onClose, appointment }: BookingDetailsModalProps) {
  const router = useRouter()

  if (!appointment) return null

  const handleEdit = () => {
    // Close modal and navigate to appointments page
    onClose()
    router.push('/admin/appointments')
    toast.info("Modification de rendez-vous", {
      description: "Veuillez utiliser la page Rendez-vous pour modifier ce rendez-vous.",
    })
  }

  const handleCancel = async () => {
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

      onClose()
      // Refresh the page to show updated data
      window.location.reload()
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Détails du Rendez-vous</span>
            <Badge variant="outline" className={getStatusColor(appointment.status)}>
              {getStatusLabel(appointment.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

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
              onClick={handleCancel}
              disabled={appointment.status === "cancelled"}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Annuler
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}