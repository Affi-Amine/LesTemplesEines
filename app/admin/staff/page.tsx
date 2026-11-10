"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useStaff } from "@/lib/hooks/use-staff"
import { useSalons } from "@/lib/hooks/use-salons"
import { Plus, Edit, Trash2, CalendarOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageUpload } from "@/components/ui/image-upload"
import { toast } from "sonner"
import { Icon } from "@iconify/react"
import { Switch } from "@/components/ui/switch"

import type { Staff } from "@/lib/types/database"

import { SalonFilter } from "@/components/salon-filter"
import { useRoleProtection } from "@/lib/hooks/use-role-protection"
import { useServices } from "@/lib/hooks/use-services"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { StaffLeave } from "@/lib/staff/leaves"

function formatLeaveDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

export default function StaffPage() {
  const isAuthorized = useRoleProtection(["admin", "manager"])
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const [selectedSalonId, setSelectedSalonId] = useState("all")
  const { data: staff, isLoading, refetch } = useStaff()
  const { data: salons } = useSalons({ includeInactive: true })
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const staffList = (staff || []).filter((member) =>
    selectedSalonId === "all" || member.salon_id === selectedSalonId
  )

  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Leaves ("congés"): while a member is on leave she takes no booking.
  const [leaveStaff, setLeaveStaff] = useState<Staff | null>(null)
  const [leaveForm, setLeaveForm] = useState({ start_date: "", end_date: "", reason: "" })
  const [isSavingLeave, setIsSavingLeave] = useState(false)
  const { data: leavesData, isLoading: leavesLoading } = useQuery({
    queryKey: ["staff-leaves", leaveStaff?.id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/staff-leaves?staff_id=${leaveStaff!.id}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de lister les congés")
      return body.leaves as StaffLeave[]
    },
    enabled: Boolean(leaveStaff),
  })

  // Form state
  const [formData, setFormData] = useState({
    salon_id: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    gender: null as "male" | "female" | null,
    phone: "",
    role: "therapist" as "therapist" | "assistant" | "manager" | "admin" | "receptionist",
    photo_url: "",
    specialties: "",
    allowed_service_ids: [] as string[],
    is_active: true,
  })
  const { data: salonServices } = useServices(formData.salon_id || undefined)

  if (!isAuthorized) return null

  const handleEdit = (member: Staff) => {
    setEditingStaff(member)
    setFormData({
      salon_id: member.salon_id,
      email: member.email,
      password: "", // Don't pre-fill password
      first_name: member.first_name,
      last_name: member.last_name,
      gender: member.gender,
      phone: member.phone || "",
      role: member.role,
      photo_url: member.photo_url || "",
      specialties: member.specialties?.join(", ") || "",
      allowed_service_ids: member.allowed_service_ids || [],
      is_active: member.is_active,
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingStaff(null)
    setFormData({
      salon_id: selectedSalonId === "all" ? "" : selectedSalonId,
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      gender: null,
      phone: "",
      role: "therapist",
      photo_url: "",
      specialties: "",
      allowed_service_ids: [],
      is_active: true,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    // Validation
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.salon_id) {
      toast.error("Erreur", {
        description: "Veuillez remplir tous les champs obligatoires",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    if (!editingStaff && !formData.password) {
      toast.error("Erreur", {
        description: "Le mot de passe est obligatoire pour un nouveau membre",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    if (formData.role === "therapist" && !formData.gender) {
      toast.error("Erreur", {
        description: "Veuillez renseigner le sexe du thérapeute",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    setIsSaving(true)
    try {
      const endpoint = editingStaff ? `/api/staff/${editingStaff.id}` : "/api/staff"
      const method = editingStaff ? "PUT" : "POST"

      const payload: any = {
        salon_id: formData.salon_id,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        gender: formData.gender,
        phone: formData.phone || undefined,
        role: formData.role,
        photo_url: formData.photo_url || undefined,
        specialties: formData.specialties ? formData.specialties.split(",").map((s) => s.trim()) : [],
        allowed_service_ids: formData.role === "therapist" ? formData.allowed_service_ids : [],
        is_active: formData.is_active,
      }

      // Only include password if provided
      if (formData.password) {
        payload.password = formData.password
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Échec de la sauvegarde du membre")
      }

      toast.success(editingStaff ? "Membre mis à jour" : "Membre créé", {
        description: `${formData.first_name} ${formData.last_name} a été ${editingStaff ? "mis à jour" : "créé"} avec succès`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      setIsDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      refetch()
    } catch (error: any) {
      toast.error("Erreur", {
        description: error.message || "Impossible de sauvegarder le membre",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenLeaves = (member: Staff) => {
    setLeaveForm({ start_date: "", end_date: "", reason: "" })
    setLeaveStaff(member)
  }

  const handleAddLeave = async () => {
    if (!leaveStaff) return
    if (!leaveForm.start_date || !leaveForm.end_date) {
      toast.error("Erreur", {
        description: "Indiquez le premier et le dernier jour du congé",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }
    setIsSavingLeave(true)
    try {
      const response = await fetch("/api/admin/staff-leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: leaveStaff.id,
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          reason: leaveForm.reason || undefined,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Congé non enregistré")
      toast.success("Congé enregistré", {
        description: `${leaveStaff.first_name} ne prendra aucun rendez-vous sur cette période`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })
      setLeaveForm({ start_date: "", end_date: "", reason: "" })
      queryClient.invalidateQueries({ queryKey: ["staff-leaves", leaveStaff.id] })
    } catch (error: any) {
      toast.error("Erreur", {
        description: error.message || "Impossible d'enregistrer le congé",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    } finally {
      setIsSavingLeave(false)
    }
  }

  const handleDeleteLeave = async (leave: StaffLeave) => {
    try {
      const response = await fetch(`/api/admin/staff-leaves/${leave.id}`, { method: "DELETE" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Échec de la suppression")
      }
      toast.success("Congé supprimé", {
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })
      queryClient.invalidateQueries({ queryKey: ["staff-leaves", leave.staff_id] })
    } catch (error: any) {
      toast.error("Erreur", {
        description: error.message || "Impossible de supprimer le congé",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  const handleDelete = async (member: Staff) => {
    if (!confirm(`Êtes-vous sûr de vouloir désactiver ${member.first_name} ${member.last_name} ?`)) return

    try {
      const response = await fetch(`/api/staff/${member.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Échec de la suppression")

      toast.success("Membre désactivé", {
        description: `${member.first_name} ${member.last_name} a été désactivé`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      queryClient.invalidateQueries({ queryKey: ["staff"] })
      refetch()
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible de désactiver le membre",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.staff")} description={t("admin.staff")} />

      <div className="space-y-4 p-3 sm:p-6 md:space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("admin.staff")}</h2>
          <div className="flex items-center gap-4">
            <SalonFilter selectedSalonId={selectedSalonId} onSelectSalon={setSelectedSalonId} salons={salons} />
            <Button onClick={handleCreate} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              {t("common.add")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="h-40 bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-8 bg-muted rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffList.map((emp) => (
              <Card key={emp.id} className="overflow-hidden">
                <div className="relative h-40 bg-muted">
                  {emp.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={emp.photo_url}
                      alt={`${emp.first_name} ${emp.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-primary/5">
                      <Icon icon="solar:user-bold" className="w-12 h-12 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <Badge variant={emp.is_active ? "default" : "secondary"}>
                      {emp.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">
                    {emp.first_name} {emp.last_name}
                  </h3>
                  {emp.gender && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {emp.gender === "male" ? "Homme" : "Femme"}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mb-1 capitalize">{emp.role}</p>
                  <p className="text-xs text-muted-foreground mb-1">
                    {salons?.find((salon) => salon.id === emp.salon_id)?.name || "Salon non affecté"}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">{emp.email}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {emp.specialties && emp.specialties.length > 0 ? (
                      emp.specialties.slice(0, 2).map((spec) => (
                        <Badge key={spec} variant="secondary" className="text-xs">
                          {spec}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Tous les soins
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(emp)}
                      className="flex-1 cursor-pointer"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenLeaves(emp)}
                      className="cursor-pointer"
                      title="Congés"
                    >
                      <CalendarOff className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(emp)}
                      className="text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && staffList.length === 0 && (
          <Card className="p-12 text-center">
            <Icon icon="solar:user-bold" className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun membre</h3>
            <p className="text-muted-foreground mb-4">Commencez par ajouter votre premier membre du personnel</p>
            <Button onClick={handleCreate} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un membre
            </Button>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Modifier le membre" : "Nouveau membre"}</DialogTitle>
            <DialogDescription>
              {editingStaff
                ? "Modifiez les informations du membre du personnel"
                : "Ajoutez un nouveau membre à votre équipe"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">
                  Prénom <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Marie"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">
                  Nom <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Dubois"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="marie.dubois@lestemples.fr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Mot de passe {!editingStaff && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingStaff ? "Laisser vide pour ne pas changer" : "Minimum 8 caractères"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salon_id">
                  Salon <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.salon_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, salon_id: value, allowed_service_ids: [] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un salon" />
                  </SelectTrigger>
                  <SelectContent>
                    {salons?.map((salon: any) => (
                      <SelectItem key={salon.id} value={salon.id}>
                        {salon.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">
                  Sexe {formData.role === "therapist" && <span className="text-red-500">*</span>}
                </Label>
                <Select
                  value={formData.gender ?? "unspecified"}
                  onValueChange={(value: "male" | "female" | "unspecified") =>
                    setFormData({ ...formData, gender: value === "unspecified" ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un sexe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Non renseigné</SelectItem>
                    <SelectItem value="female">Femme</SelectItem>
                    <SelectItem value="male">Homme</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">
                  Rôle <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "therapist" | "assistant" | "manager" | "admin" | "receptionist") => 
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="therapist">Thérapeute</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="receptionist">Réceptionniste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+33 1 23 45 67 89"
              />
            </div>

            <div className="space-y-2">
              <Label>Photo du membre</Label>
              <ImageUpload
                value={formData.photo_url}
                onChange={(url) => setFormData({ ...formData, photo_url: url })}
                bucketName="staff-photos"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialties">Spécialités (séparées par des virgules)</Label>
              <Input
                id="specialties"
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                placeholder="Massage suédois, Massage de Thaïlande"
              />
            </div>

            {formData.role === "therapist" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Soins autorisés</Label>
                  <p className="text-xs text-muted-foreground">
                    Si aucun soin n&apos;est sélectionné, ce thérapeute pourra être affecté à tous les soins du salon.
                  </p>
                </div>
                {formData.salon_id ? (
                  salonServices && salonServices.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 max-h-56 overflow-y-auto">
                      {salonServices.map((service) => {
                        const isChecked = formData.allowed_service_ids.includes(service.id)
                        return (
                          <label
                            key={service.id}
                            className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setFormData((current) => ({
                                  ...current,
                                  allowed_service_ids: e.target.checked
                                    ? [...current.allowed_service_ids, service.id]
                                    : current.allowed_service_ids.filter((serviceId) => serviceId !== service.id),
                                }))
                              }}
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <p className="font-medium">{service.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {service.duration_minutes} min
                              </p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun soin actif trouvé pour ce salon.</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">Choisissez d&apos;abord un salon.</p>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Membre actif
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="cursor-pointer">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="cursor-pointer">
              {isSaving ? "Enregistrement..." : editingStaff ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leaves Dialog */}
      <Dialog open={Boolean(leaveStaff)} onOpenChange={(open) => { if (!open) setLeaveStaff(null) }}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Congés — {leaveStaff?.first_name} {leaveStaff?.last_name}
            </DialogTitle>
            <DialogDescription>
              Pendant un congé, aucune réservation n&apos;est possible : les créneaux disparaissent
              du site et le planning refuse tout rendez-vous sur la période.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leave_start">
                  Premier jour <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="leave_start"
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({
                    ...leaveForm,
                    start_date: e.target.value,
                    end_date: leaveForm.end_date && leaveForm.end_date < e.target.value ? e.target.value : leaveForm.end_date,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave_end">
                  Dernier jour <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="leave_end"
                  type="date"
                  min={leaveForm.start_date || undefined}
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave_reason">Motif (facultatif)</Label>
              <Input
                id="leave_reason"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Vacances, arrêt maladie…"
              />
            </div>
            <Button onClick={handleAddLeave} disabled={isSavingLeave} className="w-full cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              {isSavingLeave ? "Enregistrement..." : "Ajouter le congé"}
            </Button>

            <div className="space-y-2">
              <Label>Congés enregistrés</Label>
              {leavesLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : leavesData && leavesData.length > 0 ? (
                <div className="space-y-2">
                  {leavesData.map((leave) => {
                    const today = new Date().toISOString().slice(0, 10)
                    const current = leave.start_date <= today && leave.end_date >= today
                    return (
                      <div key={leave.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {leave.start_date === leave.end_date
                              ? formatLeaveDate(leave.start_date)
                              : `Du ${formatLeaveDate(leave.start_date)} au ${formatLeaveDate(leave.end_date)}`}
                            {current && <Badge className="ml-2" variant="destructive">En cours</Badge>}
                          </p>
                          {leave.reason && <p className="text-xs text-muted-foreground truncate">{leave.reason}</p>}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteLeave(leave)}
                          className="shrink-0 text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun congé à venir.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveStaff(null)} className="cursor-pointer">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
