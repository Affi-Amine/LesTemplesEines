"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useStaff } from "@/lib/hooks/use-staff"
import { useSalons } from "@/lib/hooks/use-salons"
import { Plus, Edit, Trash2 } from "lucide-react"
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
import { toast } from "sonner"
import { Icon } from "@iconify/react"
import { Switch } from "@/components/ui/switch"

type Staff = {
  id: string
  salon_id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  role: "therapist" | "assistant" | "manager" | "admin"
  photo_url?: string
  specialties?: string[]
  is_active: boolean
}

export default function StaffPage() {
  const { t } = useTranslations()
  const { data: staff, isLoading, refetch } = useStaff()
  const { data: salons } = useSalons()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    salon_id: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "therapist" as "therapist" | "assistant" | "manager" | "admin",
    photo_url: "",
    specialties: "",
    is_active: true,
  })

  const handleEdit = (member: Staff) => {
    setEditingStaff(member)
    setFormData({
      salon_id: member.salon_id,
      email: member.email,
      password: "", // Don't pre-fill password
      first_name: member.first_name,
      last_name: member.last_name,
      phone: member.phone || "",
      role: member.role,
      photo_url: member.photo_url || "",
      specialties: member.specialties?.join(", ") || "",
      is_active: member.is_active,
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingStaff(null)
    setFormData({
      salon_id: "",
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      phone: "",
      role: "therapist",
      photo_url: "",
      specialties: "",
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

    setIsSaving(true)
    try {
      const endpoint = editingStaff ? `/api/staff/${editingStaff.id}` : "/api/staff"
      const method = editingStaff ? "PUT" : "POST"

      const payload: any = {
        salon_id: formData.salon_id,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || undefined,
        role: formData.role,
        photo_url: formData.photo_url || undefined,
        specialties: formData.specialties ? formData.specialties.split(",").map((s) => s.trim()) : [],
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
        throw new Error(error.error || "Failed to save staff")
      }

      toast.success(editingStaff ? "Membre mis à jour" : "Membre créé", {
        description: `${formData.first_name} ${formData.last_name} a été ${editingStaff ? "mis à jour" : "créé"} avec succès`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      setIsDialogOpen(false)
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

  const handleDelete = async (member: Staff) => {
    if (!confirm(`Êtes-vous sûr de vouloir désactiver ${member.first_name} ${member.last_name} ?`)) return

    try {
      const response = await fetch(`/api/staff/${member.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast.success("Membre désactivé", {
        description: `${member.first_name} ${member.last_name} a été désactivé`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

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

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("admin.staff")}</h2>
          <Button onClick={handleCreate} className="gap-2 cursor-pointer">
            <Plus className="w-4 h-4" />
            {t("common.add")}
          </Button>
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
            {staff?.map((emp) => (
              <Card key={emp.id} className="overflow-hidden">
                <div className="relative h-40 bg-muted">
                  <Image
                    src={emp.photo_url || "/placeholder.svg?height=160&width=300"}
                    alt={`${emp.first_name} ${emp.last_name}`}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.svg?height=160&width=300"
                    }}
                  />
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
                  <p className="text-sm text-muted-foreground mb-1 capitalize">{emp.role}</p>
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
                        Toutes spécialités
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

        {!isLoading && staff && staff.length === 0 && (
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <Select value={formData.salon_id} onValueChange={(value) => setFormData({ ...formData, salon_id: value })}>
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
                <Label htmlFor="role">
                  Rôle <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="therapist">Thérapeute</SelectItem>
                    <SelectItem value="assistant">Assistant(e)</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
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
              <Label htmlFor="photo_url">URL de la photo</Label>
              <Input
                id="photo_url"
                value={formData.photo_url}
                onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                placeholder="https://example.com/photo.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialties">Spécialités (séparées par des virgules)</Label>
              <Input
                id="specialties"
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                placeholder="Massage suédois, Massage thaïlandais"
              />
            </div>

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
    </div>
  )
}
