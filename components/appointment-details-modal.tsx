"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  User, 
  Phone, 
  Mail, 
  Clock, 
  Calendar, 
  MapPin, 
  FileText
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog as InlineDialog, DialogContent as InlineDialogContent, DialogHeader as InlineDialogHeader, DialogTitle as InlineDialogTitle } from "@/components/ui/dialog"

interface AppointmentDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: {
    id: string
    start_time: string
    end_time: string
    status: string
    notes?: string
    client_notes?: string
    clients: {
      id: string
      first_name: string
      last_name: string
      phone: string
      email: string
    }
    services: {
      id: string
      name: string
      duration_minutes: number
      price_cents: number
      category?: string
      description?: string
    }
    salons: {
      id: string
      name: string
      city: string
      address: string
    }
  } | null
}

export function AppointmentDetailsModal({ 
  isOpen, 
  onClose, 
  appointment 
}: AppointmentDetailsModalProps) {
  if (!appointment) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "completed":
        return "bg-indigo-100 text-indigo-800 border-indigo-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatTime = (dateTime: string) => {
    return format(new Date(dateTime), "HH:mm")
  }

  const formatDate = (dateTime: string) => {
    return format(new Date(dateTime), "EEEE d MMMM yyyy", { locale: fr })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins} min` : ""}`
    }
    return `${mins} min`
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmé"
      case "pending":
        return "En attente"
      case "cancelled":
        return "Annulé"
      case "in_progress":
        return "En cours"
      case "completed":
        return "Terminé"
      case "no_show":
        return "Absence"
      default:
        return status
    }
  }

  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelSaving, setCancelSaving] = useState(false)

  const updateStatus = async (nextStatus: "in_progress" | "completed") => {
    try {
      setSaving(true)
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Impossible de mettre à jour le statut")
      }
      toast.success(
        nextStatus === "in_progress" ? "Le massage a commencé" : "Le massage est terminé",
        { description: `Statut mis à jour: ${getStatusLabel(data.status || nextStatus)}` }
      )
      // Rafraîchir la liste des rendez-vous de l'employé
      await queryClient.invalidateQueries({ queryKey: ["staff-appointments"] })
      onClose()
    } catch (e: any) {
      toast.error("Échec de la mise à jour", { description: e.message })
    } finally {
      setSaving(false)
    }
  }

  const cancelAppointment = async () => {
    if (!cancelReason.trim()) {
      toast.error("Veuillez préciser une raison d'annulation")
      return
    }
    try {
      setCancelSaving(true)
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", internal_notes: cancelReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Impossible d'annuler le rendez-vous")
      }
      toast.success("Rendez-vous annulé", { description: "La raison a été enregistrée" })
      await queryClient.invalidateQueries({ queryKey: ["staff-appointments"] })
      setCancelOpen(false)
      onClose()
    } catch (e: any) {
      toast.error("Échec de l'annulation", { description: e.message })
    } finally {
      setCancelSaving(false)
    }
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Détails du rendez-vous</span>
            <Badge className={getStatusColor(appointment.status)}>
              {getStatusLabel(appointment.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date & Time */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date & Heure
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Date :</span>
                <p className="font-medium">{formatDate(appointment.start_time)}</p>
              </div>
              <div>
                <span className="text-gray-600">Heure :</span>
                <p className="font-medium">
                  {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Client Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations du client
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">
                  {appointment.clients.first_name} {appointment.clients.last_name}
                </span>
              </div>
              <div className="flex items-center gap-2 break-words">
                <Phone className="h-4 w-4 text-gray-500" />
                <span>{appointment.clients.phone}</span>
              </div>
              <div className="flex items-center gap-2 break-words">
                <Mail className="h-4 w-4 text-gray-500" />
                <span>{appointment.clients.email}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Service Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Détails du service
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Service :</span>
                <p className="font-medium">{appointment.services.name}</p>
              </div>
              <div>
                <span className="text-gray-600">Durée :</span>
                <p className="font-medium">{formatDuration(appointment.services.duration_minutes)}</p>
              </div>
              <div>
                <span className="text-gray-600">Prix :</span>
                <p className="font-medium">€{(appointment.services.price_cents / 100).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Lieu
            </h3>
            <div className="text-sm break-words">
              <p className="font-medium">{appointment.salons.name}</p>
              <p className="text-gray-600 break-words">{appointment.salons.address}</p>
              <p className="text-gray-600 break-words">{appointment.salons.city}</p>
            </div>
          </div>

          {/* Notes */}
          {(appointment.client_notes || appointment.notes) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </h3>
                <div className="bg-gray-50 p-3 rounded-lg text-sm">
                  {appointment.client_notes || appointment.notes}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4">
            <div className="flex gap-2 w-full sm:w-auto">
              {appointment.status === "confirmed" || appointment.status === "pending" ? (
                <Button className="w-full sm:w-auto" onClick={() => updateStatus("in_progress")} disabled={saving}>
                  Commencer le massage
                </Button>
              ) : null}
              {appointment.status === "in_progress" ? (
                <Button className="w-full sm:w-auto" variant="default" onClick={() => updateStatus("completed")} disabled={saving}>
                  Terminer le massage
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button className="w-full sm:w-auto" variant="destructive" onClick={() => setCancelOpen(true)}>
                Annuler rendez vous
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Cancel Reason Popup */}
    <InlineDialog open={cancelOpen} onOpenChange={setCancelOpen}>
      <InlineDialogContent className="max-w-lg">
        <InlineDialogHeader>
          <InlineDialogTitle>Annuler le rendez-vous</InlineDialogTitle>
        </InlineDialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Raison de l'annulation</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Exemples: Le client ne s'est pas présenté, malade, demande d'annulation, autre..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelSaving}>
              Retour
            </Button>
            <Button variant="destructive" onClick={cancelAppointment} disabled={cancelSaving || !cancelReason.trim()}>
              Confirmer l'annulation
            </Button>
          </div>
        </div>
      </InlineDialogContent>
    </InlineDialog>
    </>
  )
}
