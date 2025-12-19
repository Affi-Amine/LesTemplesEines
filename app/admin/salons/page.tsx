"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useSalons } from "@/lib/hooks/use-salons"
import { Plus, MapPin, Phone, Mail, Edit, Trash2, Clock, LayoutDashboard } from "lucide-react"
import { useState } from "react"
import { useTranslations } from "@/lib/i18n/use-translations"
import Link from "next/link"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Icon } from "@iconify/react"

type Salon = {
  id: string
  name: string
  slug: string
  city: string
  address: string
  phone: string
  email?: string
  description?: string
  photo_url?: string
  opening_hours?: Record<string, { open: string; close: string }>
  is_active: boolean
}

export default function SalonsPage() {
  const { t } = useTranslations()
  const { data: salons, isLoading, refetch } = useSalons()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSalon, setEditingSalon] = useState<Salon | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    is_active: true,
  })

  const handleEdit = (salon: any) => {
    setEditingSalon(salon)
    setFormData({
      name: salon.name,
      slug: salon.slug,
      city: salon.city,
      address: salon.address,
      phone: salon.phone,
      email: salon.email || "",
      is_active: salon.is_active,
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingSalon(null)
    setFormData({
      name: "",
      slug: "",
      city: "",
      address: "",
      phone: "",
      email: "",
      is_active: true,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const endpoint = editingSalon ? `/api/salons/${editingSalon.id}` : "/api/salons"
      const method = editingSalon ? "PUT" : "POST"

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Échec de la sauvegarde du salon")
      }

      toast.success(editingSalon ? "Salon mis à jour" : "Salon créé", {
        description: `${formData.name} a été ${editingSalon ? "mis à jour" : "créé"} avec succès`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      setIsDialogOpen(false)
      refetch()
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible de sauvegarder le salon",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (salon: any) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${salon.name} ?`)) return

    try {
      const response = await fetch(`/api/salons/${salon.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Échec de la suppression")

      toast.success("Salon supprimé", {
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      refetch()
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible de supprimer le salon",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Gestion des salons" description="Gérez vos établissements Les Temples" />

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Mes salons</h2>
          <Button onClick={handleCreate} className="gap-2 cursor-pointer">
            <Plus className="w-4 h-4" />
            Nouveau salon
          </Button>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="h-48 bg-muted" />
                <div className="p-6 space-y-3">
                  <div className="h-6 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {salons?.map((salon: any) => (
              <Card key={salon.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48 bg-gradient-to-br from-primary/10 to-primary/5">
                  {salon.photo_url ? (
                    <img src={salon.photo_url} alt={salon.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Icon icon="solar:building-bold" className="w-16 h-16 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <Badge variant={salon.is_active ? "default" : "secondary"}>
                      {salon.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">{salon.name}</h3>
                    <p className="text-sm text-muted-foreground">{salon.city}</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{salon.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{salon.phone}</span>
                    </div>
                    {salon.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{salon.email}</span>
                      </div>
                    )}
                    {salon.opening_hours?.monday && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {salon.opening_hours.monday.open} - {salon.opening_hours.monday.close}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button asChild variant="default" size="sm" className="flex-1 cursor-pointer">
                      <Link href={`/admin/salons/${salon.id}/dashboard`}>
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Dashboard
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(salon)}
                      className="cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(salon)}
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

        {!isLoading && salons && salons.length === 0 && (
          <Card className="p-12 text-center">
            <Icon icon="solar:building-bold" className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun salon</h3>
            <p className="text-muted-foreground mb-4">Commencez par créer votre premier salon</p>
            <Button onClick={handleCreate} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Créer un salon
            </Button>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSalon ? "Modifier le salon" : "Nouveau salon"}</DialogTitle>
            <DialogDescription>
              {editingSalon ? "Modifiez les informations du salon" : "Ajoutez un nouveau salon à votre réseau"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du salon *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Les Temples Paris"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="temple-paris"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Paris"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+33 1 23 45 67 89"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Rue de la Paix, 75001 Paris"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="paris@lestemples.fr"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Salon actif
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="cursor-pointer">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="cursor-pointer">
              {isSaving ? "Enregistrement..." : editingSalon ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
