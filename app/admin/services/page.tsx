"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useServices } from "@/lib/hooks/use-services"
import { useSalons } from "@/lib/hooks/use-salons"
import { Plus, Edit, Trash2, Clock, Tags, Search, ListFilter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useMemo, useState } from "react"
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
import { ImageUpload } from "@/components/ui/image-upload"
import { toast } from "sonner"
import { Icon } from "@iconify/react"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [bulkCategory, setBulkCategory] = useState("")
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  function getSalonNames(service: Service) {
    const ids = service.salon_ids?.length ? service.salon_ids : (service.salon_id ? [service.salon_id] : [])
    return ids
      .map((salonId) => salons?.find((s: any) => s.id === salonId)?.name)
      .filter(Boolean)
      .join(", ")
  }

  const salonFilteredServices = selectedSalonId === "all"
    ? services
    : services?.filter(service => (service.salon_ids?.length ? service.salon_ids : (service.salon_id ? [service.salon_id] : [])).includes(selectedSalonId))
  const filteredServices = salonFilteredServices?.filter((service) => {
    const query = searchTerm.trim().toLocaleLowerCase("fr-FR")
    if (!query) return true

    return [
      service.name,
      service.description || "",
      service.category || "",
      getSalonNames(service),
    ].some((value) => value.toLocaleLowerCase("fr-FR").includes(query))
  })
  const serviceCategories = useMemo(() => {
    const categories = new Map<string, string>()

    services?.forEach((service) => {
      const category = service.category?.trim().replace(/\s+/g, " ")
      if (!category) return

      categories.set(category.toLocaleLowerCase("fr-FR"), category)
    })

    return Array.from(categories.values()).sort((a, b) => a.localeCompare(b, "fr"))
  }, [services])
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, Service[]>()

    filteredServices?.forEach((service) => {
      const category = service.category?.trim() || "Sans catégorie"
      groups.set(category, [...(groups.get(category) || []), service])
    })

    return Array.from(groups.entries())
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.name.localeCompare(b.name, "fr")),
      }))
      .sort((a, b) => {
        if (a.category === "Sans catégorie") return 1
        if (b.category === "Sans catégorie") return -1
        return a.category.localeCompare(b.category, "fr")
      })
  }, [filteredServices])

  const [editingService, setEditingService] = useState<Service | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    salon_ids: [] as string[],
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
      salon_ids: service.salon_ids?.length ? service.salon_ids : (service.salon_id ? [service.salon_id] : []),
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
      salon_ids: [],
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
    if (!formData.name || formData.salon_ids.length === 0 || !formData.price_cents || !formData.duration_minutes) {
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
        salon_ids: formData.salon_ids,
        name: formData.name,
        description: formData.description || undefined,
        duration_minutes: parseInt(formData.duration_minutes),
        price_cents: parseInt(formData.price_cents),
        category: formData.category.trim() || null,
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

  const toggleServiceSelection = (serviceId: string, checked: boolean) => {
    setSelectedServiceIds((current) =>
      checked
        ? Array.from(new Set([...current, serviceId]))
        : current.filter((id) => id !== serviceId)
    )
  }

  const toggleAllFilteredServices = (checked: boolean) => {
    setSelectedServiceIds(checked ? (filteredServices || []).map((service) => service.id) : [])
  }

  const handleBulkCategorySave = async () => {
    if (selectedServiceIds.length === 0) {
      toast.error("Aucune prestation sélectionnée")
      return
    }

    setIsBulkSaving(true)
    try {
      await Promise.all(
        selectedServiceIds.map((serviceId) =>
          fetch(`/api/services/${serviceId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: bulkCategory.trim() || null,
            }),
          }).then(async (response) => {
            if (!response.ok) {
              const error = await response.json().catch(() => ({}))
              throw new Error(error.error || "Échec de la mise à jour")
            }
          })
        )
      )

      toast.success("Catégories mises à jour", {
        description: `${selectedServiceIds.length} prestation${selectedServiceIds.length > 1 ? "s" : ""} modifiée${selectedServiceIds.length > 1 ? "s" : ""}.`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })
      setSelectedServiceIds([])
      setBulkCategory("")
      refetch()
    } catch (error: any) {
      toast.error("Erreur", {
        description: error.message || "Impossible de mettre à jour les catégories",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    } finally {
      setIsBulkSaving(false)
    }
  }

  const toggleSalonSelection = (salonId: string, checked: boolean) => {
    setFormData((current) => ({
      ...current,
      salon_ids: checked
        ? Array.from(new Set([...current.salon_ids, salonId]))
        : current.salon_ids.filter((id) => id !== salonId),
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Gestion des services" description="Gérez les prestations de vos salons" />

      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Prestations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vue dense pour gérer les prix, durées, salons et catégories sans ouvrir chaque fiche.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SalonFilter selectedSalonId={selectedSalonId} onSelectSalon={setSelectedSalonId} />
            <Button onClick={handleCreate} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              Nouveau service
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher une prestation, une catégorie, un salon..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListFilter className="h-4 w-4" />
            {filteredServices?.length || 0} prestation{(filteredServices?.length || 0) > 1 ? "s" : ""}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 rounded-lg border bg-card p-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="list" className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="list">Liste</TabsTrigger>
              <TabsTrigger value="categories">Catégories</TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              <div className="overflow-x-auto rounded-lg border bg-card">
                <div className="grid grid-cols-[44px_minmax(260px,1.5fr)_140px_110px_140px_190px_96px] items-center border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Checkbox
                    checked={Boolean(filteredServices?.length && selectedServiceIds.length === filteredServices.length)}
                    onCheckedChange={(checked) => toggleAllFilteredServices(checked === true)}
                  />
                  <span>Prestation</span>
                  <span>Catégorie</span>
                  <span>Durée</span>
                  <span>Prix</span>
                  <span>Salons</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="divide-y">
                  {filteredServices?.map((service: Service) => (
                    <div
                      key={service.id}
                      className="grid grid-cols-[44px_minmax(260px,1.5fr)_140px_110px_140px_190px_96px] items-center px-3 py-3 text-sm transition-colors hover:bg-muted/35"
                    >
                      <Checkbox
                        checked={selectedServiceIds.includes(service.id)}
                        onCheckedChange={(checked) => toggleServiceSelection(service.id, checked === true)}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{service.name}</p>
                          <Badge variant={service.is_active ? "default" : "secondary"} className="shrink-0">
                            {service.is_active ? "Actif" : "Inactif"}
                          </Badge>
                          {service.required_staff_count > 1 ? (
                            <Badge variant="outline" className="shrink-0">x{service.required_staff_count}</Badge>
                          ) : null}
                        </div>
                        {service.description ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">{service.description}</p>
                        ) : null}
                      </div>
                      <div>
                        {service.category ? (
                          <Badge variant="outline">{service.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Sans catégorie</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {service.duration_minutes} min
                      </div>
                      <div className="font-semibold text-primary">
                        {(service.price_cents / 100).toFixed(2)} €
                      </div>
                      <div className="truncate text-muted-foreground">
                        {getSalonNames(service) || "Aucun salon"}
                      </div>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(service)} className="cursor-pointer">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(service)} className="cursor-pointer text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <Card className="gap-4 rounded-lg p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="font-semibold">Affectation en masse</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sélectionnez des prestations dans les groupes ci-dessous, puis appliquez une catégorie commune.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={bulkCategory || "__custom__"} onValueChange={(value) => setBulkCategory(value === "__custom__" ? "" : value)}>
                      <SelectTrigger className="w-full sm:w-[220px]">
                        <SelectValue placeholder="Catégorie cible" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__custom__">Nouvelle catégorie</SelectItem>
                        {serviceCategories.map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={bulkCategory}
                      onChange={(event) => setBulkCategory(event.target.value)}
                      placeholder="Nom de catégorie"
                      className="w-full sm:w-[220px]"
                    />
                    <Button onClick={handleBulkCategorySave} disabled={isBulkSaving || selectedServiceIds.length === 0}>
                      {isBulkSaving ? "Application..." : `Appliquer (${selectedServiceIds.length})`}
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                {categoryGroups.map(({ category, items }) => (
                  <Card key={category} className="gap-3 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{category}</h4>
                        <p className="text-sm text-muted-foreground">{items.length} prestation{items.length > 1 ? "s" : ""}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const ids = items.map((service) => service.id)
                          const allSelected = ids.every((id) => selectedServiceIds.includes(id))
                          setSelectedServiceIds((current) =>
                            allSelected
                              ? current.filter((id) => !ids.includes(id))
                              : Array.from(new Set([...current, ...ids]))
                          )
                        }}
                      >
                        {items.every((service) => selectedServiceIds.includes(service.id)) ? "Retirer" : "Sélectionner"}
                      </Button>
                    </div>
                    <div className="divide-y rounded-md border">
                      {items.map((service) => (
                        <label key={service.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/35">
                          <Checkbox
                            checked={selectedServiceIds.includes(service.id)}
                            onCheckedChange={(checked) => toggleServiceSelection(service.id, checked === true)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{service.name}</span>
                          <span className="text-xs text-muted-foreground">{service.duration_minutes} min</span>
                        </label>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
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

            <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-4">
              <Label htmlFor="category" className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-primary" />
                Catégorie d&apos;affichage
              </Label>
              <Input
                id="category"
                list="service-category-options"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Massages, Duo, Hammam, Réflexologie"
              />
              <datalist id="service-category-options">
                {serviceCategories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              {serviceCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {serviceCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setFormData({ ...formData, category })}
                      className="rounded-full border border-primary/15 bg-background/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Les prestations avec exactement la même catégorie sont regroupées ensemble sur mobile, carte cadeau, pages salons et page nos prestations.
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                Salons <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-3 rounded-md border p-4">
                {salons?.map((salon: any) => (
                  <div key={salon.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`salon-${salon.id}`}
                      checked={formData.salon_ids.includes(salon.id)}
                      onCheckedChange={(checked) => toggleSalonSelection(salon.id, checked === true)}
                    />
                    <Label htmlFor={`salon-${salon.id}`} className="cursor-pointer font-normal">
                      {salon.name}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Le service sera visible uniquement dans les salons sélectionnés.
              </p>
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
              <Label>Image du service</Label>
              <ImageUpload
                value={formData.image_url}
                onChange={(url) => setFormData({ ...formData, image_url: url })}
                bucketName="service-images"
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
