"use client"
import { AppointmentManagementLinkButton } from "@/components/appointment-management-link-button"


import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AppointmentPaymentBadge } from "@/components/appointment-payment-badge"
import { AppointmentProgressActions } from "@/components/appointment-progress-actions"
import { getAppointmentColor, getStatusLabel } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, User, MapPin, Scissors, Phone, Mail, FileText, Edit, X } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { dateTimeInScheduleTimezone, getAppointmentStaffIds, canStaffTakeBookings } from "@/lib/calendar/scheduling"
import { canProvideService } from "@/lib/appointments/rules"

interface BookingDetailsModalProps {
  isOpen: boolean
  startInEditMode?: boolean
  onClose: () => void
  onRefetch?: () => void
  appointment: {
    id: string
    start_time: string
    end_time: string
    status: string
    updated_at?: string | null
    payment_status?: string | null
    payment_method?: string | null
    client_notes?: string
    salon_id?: string
    service_id?: string
    staff_id?: string
    assignments?: any[]
    client?: {
      first_name: string
      last_name: string
      phone?: string
      email?: string
    }
    staff?: {
      id?: string
      first_name: string
      last_name: string
      role?: string
      phone?: string
    }
    service?: {
      id?: string
      name: string
      duration?: number
      price?: number
    }
    salon?: {
      id?: string
      name: string
      address?: string
      city?: string
      phone?: string
    }
  } | null
}

export function BookingDetailsModal({ isOpen, onClose, onRefetch, appointment, startInEditMode = false }: BookingDetailsModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  useEffect(() => { setLiveStatus(null) }, [appointment?.id, appointment?.status])
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState("")
  const saving = useRef(false)
  useEffect(() => {
    if (isOpen) setIsEditMode(startInEditMode)
  }, [isOpen, appointment?.id, startInEditMode])
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
    queryKey: ["salons", { includeInactive: true }],
    queryFn: () => fetchAPI<any[]>("/salons?include_inactive=true"),
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
      const staffIds: string[] = getAppointmentStaffIds(appointment)
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
    if (saving.current) return
    saving.current = true
    setIsSaving(true)
    setEditError("")
    try {
      const releasing = ["cancelled", "no_show"].includes(editForm.status)
      const payload: Record<string, unknown> = { expected_updated_at: appointment.updated_at || undefined }
      if (editForm.status !== appointment.status) payload.status = editForm.status
      if (editForm.notes !== (appointment.client_notes || "")) payload.client_notes = editForm.notes
      if (!releasing) {
        if (editForm.salon_id !== (appointment.salon_id || appointment.salon?.id || "")) payload.salon_id = editForm.salon_id
        if (editForm.service_id !== (appointment.service_id || appointment.service?.id || "")) payload.service_id = editForm.service_id
        if ([...editForm.staff_ids].sort().join() !== getAppointmentStaffIds(appointment).sort().join()) payload.staff_ids = editForm.staff_ids
        if (editForm.date !== formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd") || editForm.time !== formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")) {
          const parisTime = dateTimeInScheduleTimezone(new Date(`${editForm.date}T00:00:00`), editForm.time)
          if (!parisTime) throw new Error("Horaire invalide")
          payload.start_time = parisTime.toISOString()
        }
      }
      if (Object.keys(payload).length === 1) { setIsEditMode(false); onClose(); return }

      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Échec de la mise à jour")
      }

      toast.success("Rendez-vous mis à jour", {
        description: `Le rendez-vous a été mis à jour avec succès`,
      })

      setIsEditMode(false)
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
      ])
      onRefetch?.()
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de mettre à jour le rendez-vous"
      setEditError(message)
      toast.error("Erreur lors de la mise à jour", {
        description: message,
      })
    } finally {
      saving.current = false
      setIsSaving(false)
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
      if (saving.current) return
      setIsEditMode(false)
      onClose()
    }}>
      <DialogContent showCloseButton={!isSaving} className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-2 leading-snug">
            <span>{isEditMode ? "Modifier le rendez-vous" : "Détails du Rendez-vous"}</span>
            {!isEditMode && (
              <Badge variant="outline" className={getAppointmentColor({ ...appointment, status: liveStatus || appointment.status })}>
                {getStatusLabel(liveStatus || appointment.status)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{isEditMode ? "Modifier les détails du rendez-vous" : "Client, prestation et actions du rendez-vous"}</DialogDescription>
        </DialogHeader>

        {!isEditMode && <AppointmentPaymentBadge appointment={appointment} />}

        {isEditMode ? (
          /* Edit Mode */
          <fieldset disabled={isSaving} className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-salon">Salon</Label>
                <Select value={editForm.salon_id} onValueChange={(value) => setEditForm({ ...editForm, salon_id: value, service_id: "", staff_ids: [] })}>
                  <SelectTrigger id="edit-salon">
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
                  <SelectTrigger id="edit-service">
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
                <SelectTrigger id="edit-therapist">
                  <SelectValue placeholder="Ajouter un thérapeute" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.filter(m => !editForm.staff_ids.includes(m.id) && canStaffTakeBookings(m) && canProvideService(m.allowed_service_ids, editForm.service_id)).map((member) => (
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  {appointment.status === "pending" && <SelectItem value="pending">En attente</SelectItem>}
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

            {editError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{editError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelEdit}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} className="cursor-pointer">
                {isSaving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </fieldset>
        ) : (
          /* View Mode */

        <div className="space-y-6">
          <AppointmentProgressActions appointment={{ ...appointment, status: liveStatus || appointment.status }}
            onUpdated={status => { setLiveStatus(status); onRefetch?.() }} />
          <AppointmentManagementLinkButton appointment={appointment} />
          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Date
              </div>
              <p className="text-lg font-semibold">
                {formatInTimeZone(appointment.start_time, "Europe/Paris", "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="w-4 h-4" />
                Heure
              </div>
              <p className="text-lg font-semibold">
                {formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")} - {formatInTimeZone(appointment.end_time, "Europe/Paris", "HH:mm")}
              </p>
            </div>
          </div>

          {appointment.client && (
            <>
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
                      <span className="min-w-0 break-all">{appointment.client.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Staff Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="w-4 h-4" />
              Thérapeute
            </div>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-lg">
                {appointment.staff?.first_name || "Prestataire"} {appointment.staff?.last_name || ""}
              </p>
              {appointment.staff?.role && (
                <p className="text-sm text-muted-foreground">{appointment.staff.role}</p>
              )}
              {appointment.staff?.phone && (
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
              <p className="font-semibold text-lg">{appointment.service?.name || "Créneau bloqué"}</p>
              <div className="flex gap-4 text-sm">
                {appointment.service?.duration && (
                  <span>Durée: {formatDuration(appointment.service.duration)}</span>
                )}
                {appointment.service?.price && (
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
              <p className="font-semibold text-lg">{appointment.salon?.name || "Salon"}</p>
              {appointment.salon?.address && (
                <p className="text-sm">
                  {appointment.salon.address}
                  {appointment.salon.city && `, ${appointment.salon.city}`}
                </p>
              )}
              {appointment.salon?.phone && (
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
          <div className="flex flex-col gap-2 pt-4 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={handleEdit}
            >
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>

          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
