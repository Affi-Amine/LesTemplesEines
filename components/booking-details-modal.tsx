"use client"
import { AppointmentManagementLinkButton } from "@/components/appointment-management-link-button"


import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AppointmentPaymentBadge } from "@/components/appointment-payment-badge"
import { AppointmentProgressActions } from "@/components/appointment-progress-actions"
import { ClientDetailsModal } from "@/components/client-details-modal"
import { ClientSuggestionList } from "@/components/client-suggestion-list"
import { useClientSearch } from "@/lib/hooks/use-client-search"
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
      id?: string
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
  const [clientFileOpen, setClientFileOpen] = useState(false)
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
    client_id: "",
    client_label: "",
  })
  const [clientQuery, setClientQuery] = useState("")
  const [debouncedClientQuery, setDebouncedClientQuery] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientQuery(clientQuery.trim()), 250)
    return () => clearTimeout(timer)
  }, [clientQuery])
  const { data: clientMatches, isFetching: isSearchingClients } = useClientSearch(debouncedClientQuery, 6)

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
        client_id: appointment.client?.id || "",
        client_label: `${appointment.client?.first_name || ""} ${appointment.client?.last_name || ""}`.trim(),
      })
      setClientQuery("")
    }
  }, [appointment, isEditMode])

  // Same rules as the save (free slot, masseuses, duo/solo, hours, pack, price):
  // the server runs them without writing, so the admin sees the outcome first.
  const [check, setCheck] = useState<EditCheck>({ state: "idle" })
  const editKey = JSON.stringify(editForm)
  useEffect(() => {
    if (!appointment || !isEditMode) return setCheck({ state: "idle" })
    let payload: Record<string, unknown>
    try {
      payload = buildEditPayload(appointment, editForm)
    } catch (error) {
      return setCheck({ state: "error", message: error instanceof Error ? error.message : "Horaire invalide" })
    }
    if (!["salon_id", "service_id", "staff_ids", "start_time"].some(key => key in payload)) return setCheck({ state: "idle" })
    if (!editForm.service_id) return setCheck({ state: "error", message: "Choisissez une prestation." })
    if (!editForm.staff_ids.length) return setCheck({ state: "error", message: "Choisissez au moins une masseuse." })

    setCheck({ state: "checking" })
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/appointments/${appointment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, dry_run: true }),
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        setCheck(response.ok ? { state: "ok", preview: data } : { state: "error", message: data.error || "Vérification impossible" })
      } catch {
        if (!controller.signal.aborted) setCheck({ state: "error", message: "Vérification impossible. Réessayez." })
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
    // editKey stands for editForm; the appointment version restarts the check after a refresh.
  }, [appointment?.id, appointment?.updated_at, isEditMode, editKey])

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
      const payload = buildEditPayload(appointment, editForm)
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

      const saved = await response.json().catch(() => ({}))
      toast.success("Rendez-vous mis à jour", {
        description: describeServicePayment(saved.service_change_payment) || "Le rendez-vous a été mis à jour avec succès",
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
                        {[service.name, service.duration_minutes ? `${service.duration_minutes} min` : null, typeof service.price_cents === "number" ? euros(service.price_cents) : null].filter(Boolean).join(" · ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-client">Client</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{editForm.client_label || "Sans client"}</Badge>
              </div>
              <Input
                id="edit-client"
                value={clientQuery}
                onChange={(event) => setClientQuery(event.target.value)}
                placeholder="Changer de client : nom, téléphone ou email"
              />
              <ClientSuggestionList
                visible={clientQuery.trim().length >= 2}
                clients={clientMatches}
                isLoading={isSearchingClients}
                onSelect={(client) => {
                  setEditForm(current => ({
                    ...current,
                    client_id: client.id,
                    client_label: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
                  }))
                  setClientQuery("")
                }}
              />
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

            {check.state !== "idle" && (
              <div role="status" aria-live="polite" className={`space-y-1 rounded-lg border p-3 text-sm ${
                check.state === "error" ? "border-destructive/30 bg-destructive/10"
                  : check.state === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "bg-muted/40 text-muted-foreground"}`}>
                {check.state === "checking" && <p>Vérification du créneau et du tarif…</p>}
                {check.state === "error" && <><p className="font-semibold">Modification impossible</p><p>{check.message}</p></>}
                {check.state === "ok" && check.preview && <>
                  <p className="font-semibold">
                    Créneau libre · {formatInTimeZone(check.preview.start_time, "Europe/Paris", "HH:mm")} – {formatInTimeZone(check.preview.end_time, "Europe/Paris", "HH:mm")}
                    {check.preview.staff_ids.length > 0 && ` · ${check.preview.staff_ids.map(id => {
                      const member = staff?.find(item => item.id === id)
                      return member ? `${member.first_name || ""} ${member.last_name || ""}`.trim() : "Masseuse"
                    }).join(" + ")}`}
                  </p>
                  {check.preview.payment && check.preview.payment.previous_price_cents !== check.preview.payment.price_cents && (
                    <p>Prix : {euros(check.preview.payment.previous_price_cents)} → {euros(check.preview.payment.price_cents)}</p>
                  )}
                  {check.preview.payment && <p>{describeServicePayment(check.preview.payment)}</p>}
                </>}
              </div>
            )}
            {editError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{editError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelEdit}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} disabled={check.state === "checking" || check.state === "error"} className="cursor-pointer">
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
                  {appointment.client.phone && (
                    <a href={`tel:${appointment.client.phone}`} className="inline-flex h-10 items-center gap-2 text-sm font-medium text-primary hover:underline">
                      <Phone className="h-4 w-4" />Appeler
                    </a>
                  )}
                  {appointment.client.id && (
                    <Button type="button" variant="outline" className="w-full" onClick={() => setClientFileOpen(true)}>
                      <User className="mr-2 h-4 w-4" />Fiche client et historique
                    </Button>
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
      {appointment.client?.id && (
        <ClientDetailsModal
          open={clientFileOpen}
          onOpenChange={setClientFileOpen}
          client={appointment.client}
          showHistory
        />
      )}
    </Dialog>
  )
}

type EditableAppointment = NonNullable<BookingDetailsModalProps["appointment"]>
type EditForm = { salon_id: string; service_id: string; staff_ids: string[]; date: string; time: string; status: string; notes: string; client_id: string; client_label: string }

interface ServicePaymentPreview {
  previous_price_cents: number
  price_cents: number
  paid_cents: number
  due_cents: number
  overpaid_cents: number
  covered_by_pack: boolean
}

type EditCheck =
  | { state: "idle" | "checking" }
  | { state: "error"; message: string }
  | { state: "ok"; preview: { start_time: string; end_time: string; staff_ids: string[]; payment: ServicePaymentPreview | null } }

const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)

/** Only the fields that differ from the booking, plus its version for the stale-edit check. */
function buildEditPayload(appointment: EditableAppointment, form: EditForm) {
  const releasing = ["cancelled", "no_show"].includes(form.status)
  const payload: Record<string, unknown> = { expected_updated_at: appointment.updated_at || undefined }
  if (form.status !== appointment.status) payload.status = form.status
  if (form.notes !== (appointment.client_notes || "")) payload.client_notes = form.notes
  if (!releasing) {
    if (form.client_id && form.client_id !== (appointment.client?.id || "")) payload.client_id = form.client_id
    if (form.salon_id !== (appointment.salon_id || appointment.salon?.id || "")) payload.salon_id = form.salon_id
    if (form.service_id !== (appointment.service_id || appointment.service?.id || "")) payload.service_id = form.service_id
    if ([...form.staff_ids].sort().join() !== getAppointmentStaffIds(appointment).sort().join()) payload.staff_ids = form.staff_ids
    if (form.date !== formatInTimeZone(appointment.start_time, "Europe/Paris", "yyyy-MM-dd") || form.time !== formatInTimeZone(appointment.start_time, "Europe/Paris", "HH:mm")) {
      const parisTime = dateTimeInScheduleTimezone(new Date(`${form.date}T00:00:00`), form.time)
      if (!parisTime) throw new Error("Horaire invalide")
      payload.start_time = parisTime.toISOString()
    }
  }
  return payload
}

/** What the new prestation means for the till; empty when the service did not change. */
function describeServicePayment(payment?: ServicePaymentPreview | null) {
  if (!payment) return ""
  if (payment.covered_by_pack) return "Couvert par le forfait du client : rien à encaisser."
  if (payment.paid_cents === 0) return `À régler sur place : ${euros(payment.price_cents)}.`
  if (payment.due_cents > 0) return `Déjà réglé ${euros(payment.paid_cents)} · supplément à encaisser : ${euros(payment.due_cents)}.`
  if (payment.overpaid_cents > 0) return `Trop-perçu de ${euros(payment.overpaid_cents)} : à rembourser ou à garder en avoir.`
  return "Déjà réglé : rien de plus à encaisser."
}
