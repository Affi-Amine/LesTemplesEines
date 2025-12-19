"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useServices } from "@/lib/hooks/use-services"
import { useSalons } from "@/lib/hooks/use-salons"
import { Plus, Edit, Trash2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"
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

import type { Service } from "@/lib/types/database"

import { SalonFilter } from "@/components/salon-filter"
import { useRoleProtection } from "@/lib/hooks/use-role-protection"

export default function ServicesPage() {
  const isAuthorized = useRoleProtection(["admin", "manager"])
  const { t } = useTranslations()
  const { data: services, isLoading, refetch } = useServices(undefined, true)
  const { data: salons } = useSalons()
  const [selectedSalonId, setSelectedSalonId] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredServices = selectedSalonId === "all"
    ? services
    : services?.filter(service => service.salon_id === selectedSalonId)

  const [editingService, setEditingService] = useState<Service | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    salon_id: "",
    name: "",
    description: "",
    duration_minutes: "60",
    price_cents: "",
    category: "",
    image_url: "",
    is_active: true,
    required_staff_count: "1",
  })

  if (!isAuthorized) return null

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      salon_id: service.salon_id,
      name: service.name,
      description: service.description || "",
      duration_minutes: service.duration_minutes.toString(),
      price_cents: service.price_cents.toString(),
      category: service.category || "",
      image_url: service.image_url || "",
      is_active: service.is_active,
      required_staff_count: (service.required_staff_count || 1).toString(),
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingService(null)
    setFormData({
      salon_id: "",
      name: "",
      description: "",
      duration_minutes: "60",
      price_cents: "",
      category: "",
      image_url: "",
      is_active: true,
      required_staff_count: "1",
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    // Validation
    if (!formData.name || !formData.salon_id || !formData.price_cents || !formData.duration_minutes) {
      toast.error("Erreur", {
        description: "Veuillez remplir tous les champs obligatoires",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    setIsSaving(true)
    try {
      const endpoint = editingService ? `/api/services/${editingService.id}` : "/api/services"
      const method = editingService ? "PUT" : "POST"

      const payload = {
        salon_id: formData.salon_id,
        name: formData.name,
        description: formData.description || undefined,
        duration_minutes: parseInt(formData.duration_minutes),
        price_cents: parseInt(formData.price_cents),
        category: formData.category || undefined,
        image_url: formData.image_url || undefined,
        is_active: formData.is_active,
        required_staff_count: parseInt(formData.required_staff_count) || 1,
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Échec de la sauvegarde du service")
      }

      toast.success(editingService ? "Service mis à jour" : "Service créé", {
        description: `${formData.name} a été ${editingService ? "mis à jour" : "créé"} avec succès`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      setIsDialogOpen(false)
      refetch()
    } catch (error: any) {
      toast.error("Erreur", {
        description: error.message || "Impossible de sauvegarder le service",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (service: Service) => {
    if (!confirm(`Êtes-vous sûr de vouloir désactiver ${service.name} ?`)) return

    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Échec de la suppression")

      toast.success("Service désactivé", {
        description: `${service.name} a été désactivé`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      refetch()
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible de désactiver le service",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  // Get salon name helper
  const getSalonName = (salonId: string) => {
    const salon = salons?.find((s: any) => s.id === salonId)
    return salon?.name || "Unknown"
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Gestion des services" description="Gérez les prestations de vos salons" />

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Services</h2>
          <div className="flex items-center gap-4">
            <SalonFilter selectedSalonId={selectedSalonId} onSelectSalon={setSelectedSalonId} />
            <Button onClick={handleCreate} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              Nouveau service
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-6 bg-muted rounded w-2/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2 mb-4" />
                <div className="h-20 bg-muted rounded mb-4" />
                <div className="flex gap-2">
                  <div className="h-10 bg-muted rounded flex-1" />
                  <div className="h-10 bg-muted rounded w-10" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices?.map((service: Service) => (
              <Card key={service.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{service.name}</h3>
                    <p className="text-sm text-muted-foreground">{getSalonName(service.salon_id)}</p>
                  </div>
                  <Badge variant={service.is_active ? "default" : "secondary"}>
                    {service.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>

                {service.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{service.description}</p>
                )}

                {service.category && (
                  <Badge variant="outline" className="mb-4">
                    {service.category}
                  </Badge>
                )}

                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{service.duration_minutes} min</span>
                  </div>
                  <div className="font-semibold text-primary">
                    {(service.price_cents / 100).toFixed(2)} €
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(service)}
                    className="flex-1 cursor-pointer"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(service)}
                    className="text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && services && services.length === 0 && (
          <Card className="p-12 text-center">
            <Icon icon="solar:scissors-bold" className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun service</h3>
            <p className="text-muted-foreground mb-4">Commencez par créer votre premier service</p>
            <Button onClick={handleCreate} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Créer un service
            </Button>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? "Modifier le service" : "Nouveau service"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Modifiez les informations du service" : "Ajoutez un nouveau service à votre offre"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nom du service <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Massage suédois"
              />
            </div>

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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Décrivez le service..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration_minutes">
                  Durée (minutes) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="duration_minutes"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  placeholder="60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_cents">
                  Prix (centimes) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="price_cents"
                  type="number"
                  value={formData.price_cents}
                  onChange={(e) => setFormData({ ...formData, price_cents: e.target.value })}
                  placeholder="8999 pour 89.99€"
                />
                {formData.price_cents && (
                  <p className="text-xs text-muted-foreground">
                    Prix: {(parseInt(formData.price_cents) / 100).toFixed(2)} €
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="required_staff_count">
                  Masseurs requis
                </Label>
                <Input
                  id="required_staff_count"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.required_staff_count}
                  onChange={(e) => setFormData({ ...formData, required_staff_count: e.target.value })}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre de prestataires nécessaires pour ce service (ex: 2 pour duo)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Catégorie</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Massage, Soin visage, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">URL de l'image</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Service actif
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="cursor-pointer">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="cursor-pointer">
              {isSaving ? "Enregistrement..." : editingService ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
