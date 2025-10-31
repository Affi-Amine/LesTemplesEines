"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClientSearch } from "@/components/client-search"
import { ClientDetailsModal } from "@/components/client-details-modal"
import { Mail, Phone, TrendingUp, User, Plus, Edit, Trash2 } from "lucide-react"
import { useState, useMemo } from "react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
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
import { toast } from "sonner"
import { Icon } from "@iconify/react"
import { useCreateClient } from "@/lib/hooks/use-create-client"

export default function ClientsPage() {
  const { t } = useTranslations()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClient, setSelectedClient] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<any | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    internal_notes: "",
  })

  // Fetch clients from API
  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchAPI<any[]>("/clients"),
    refetchOnMount: "always",
  })

  const createClient = useCreateClient()

  const filteredClients = useMemo(() => {
    if (!clients) return []
    const filtered = clients.filter(
      (client) =>
        `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        client.phone.includes(searchQuery),
    )
    // Newest first by created_at
    return filtered.sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [clients, searchQuery])

  const handleClientClick = (client: any) => {
    setSelectedClient(client)
    setModalOpen(true)
  }

  const handleEdit = (client: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingClient(client)
    setFormData({
      first_name: client.first_name,
      last_name: client.last_name,
      phone: client.phone,
      email: client.email || "",
      internal_notes: client.internal_notes || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingClient(null)
    setFormData({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      internal_notes: "",
    })
    setIsEditDialogOpen(true)
  }

  const handleSave = async () => {
    // Validation
    if (!formData.first_name || !formData.last_name || !formData.phone) {
      toast.error("Veuillez remplir tous les champs obligatoires", {
        description: "Le prénom, le nom et le téléphone sont requis",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    setIsSaving(true)
    try {
      if (!editingClient) {
        // Use React Query mutation for create to auto-invalidate and refresh
        createClient.mutate(
          {
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
            email: formData.email || undefined,
            internal_notes: formData.internal_notes || undefined,
          },
          {
            onSuccess: () => {
              toast.success("Client créé avec succès", {
                description: `${formData.first_name} ${formData.last_name} a été créé avec succès`,
                icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
              })
              setIsEditDialogOpen(false)
              refetch()
            },
            onError: (error: any) => {
              toast.error("Erreur lors de la création", {
                description: error.message || "Une erreur est survenue lors de la création du client",
                icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
              })
            },
          },
        )
      } else {
        // Update existing client
        const endpoint = `/api/clients/${editingClient.id}`
        const response = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
            email: formData.email || undefined,
            internal_notes: formData.internal_notes || undefined,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Échec de la sauvegarde du client")
        }

        toast.success("Client mis à jour avec succès", {
          description: `${formData.first_name} ${formData.last_name} a été mis à jour avec succès`,
          icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
        })
        refetch()
        setIsEditDialogOpen(false)
      }
    } catch (error: any) {
      toast.error("Erreur lors de la sauvegarde", {
        description: error.message || "Une erreur est survenue",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (client: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${client.first_name} ${client.last_name} ?`)) return

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Échec de la suppression")

      toast.success("Client supprimé", {
        description: `${client.first_name} ${client.last_name} a été supprimé`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      refetch()
    } catch (error) {
      toast.error("Erreur lors de la suppression", {
        description: "Impossible de supprimer le client",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
    }
  }

  // Calculate stats from real data
  const totalClients = clients?.length || 0
  const totalRevenue = 0 // Will be calculated from appointments in future
  const avgSpent = totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.clients")} description={t("admin.clients")} />

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("admin.clients")}</h2>
          <Button onClick={handleCreate} className="gap-2 cursor-pointer">
            <Plus className="w-4 h-4" />
            {t("common.add")}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("admin.total_clients")}</p>
                {isLoading ? (
                  <div className="h-9 w-16 bg-muted rounded animate-pulse" />
                ) : (
                  <p className="text-3xl font-bold">{totalClients}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("admin.total_revenue")}</p>
                {isLoading ? (
                  <div className="h-9 w-20 bg-muted rounded animate-pulse" />
                ) : (
                  <p className="text-3xl font-bold">€{totalRevenue}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Dépense moyenne</p>
                {isLoading ? (
                  <div className="h-9 w-16 bg-muted rounded animate-pulse" />
                ) : (
                  <p className="text-3xl font-bold">€{avgSpent}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <ClientSearch onSearch={setSearchQuery} />

        {/* Liste des clients */}
        {isLoading ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Prénom</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Nom</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Téléphone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">E-mail</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Réservations</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Dernière visite</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5].map((i) => (
                    <tr key={i} className="border-b">
                      {[...Array(7)].map((_, idx) => (
                        <td key={idx} className="px-6 py-4">
                          <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Prénom</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Nom</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Téléphone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">E-mail</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Réservations</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Dernière visite</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client: any) => (
                    <tr key={client.id} className="border-b hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleClientClick(client)}>
                      <td className="px-6 py-4 text-sm font-medium">{client.first_name}</td>
                      <td className="px-6 py-4 text-sm">{client.last_name}</td>
                      <td className="px-6 py-4 text-sm">{client.phone}</td>
                      <td className="px-6 py-4 text-sm">{client.email || "—"}</td>
                      <td className="px-6 py-4 text-sm">{client.visit_count ?? 0}</td>
                      <td className="px-6 py-4 text-sm">
                        {client.last_visit_date ? new Date(client.last_visit_date).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="gap-2 cursor-pointer" onClick={(e) => handleEdit(client, e)}>
                            <Edit className="w-4 h-4" /> Modifier
                          </Button>
                          <Button variant="destructive" size="sm" className="gap-2 cursor-pointer" onClick={(e) => handleDelete(client, e)}>
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Client Details Modal */}
        {selectedClient && (
          <ClientDetailsModal open={modalOpen} onOpenChange={setModalOpen} client={selectedClient} />
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => setIsEditDialogOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? "Modifier le client" : "Ajouter un client"}</DialogTitle>
              <DialogDescription>
                {editingClient
                  ? "Mettez à jour les informations du client"
                  : "Ajoutez un nouveau client à votre base de données"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nom</Label>
                  <Input id="lastName" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="email">Email (optionnel)</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="notes">Notes internes (optionnel)</Label>
                <Textarea id="notes" value={formData.internal_notes} onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="cursor-pointer">Annuler</Button>
              <Button onClick={handleSave} className="cursor-pointer" disabled={isSaving}>
                {isSaving ? "Sauvegarde..." : editingClient ? "Sauvegarder" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
