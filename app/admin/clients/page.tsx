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
      toast.error("Erreur", {
        description: "Veuillez remplir tous les champs obligatoires",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
      })
      return
    }

    setIsSaving(true)

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
            toast.success("Client créé", {
              description: `${formData.first_name} ${formData.last_name} a été créé avec succès`,
              icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
            })
            setIsEditDialogOpen(false)
            setIsSaving(false)
            // Explicit refetch to ensure immediate UI update
            refetch()
          },
          onError: (error: any) => {
            toast.error("Erreur", {
              description: error.message || "Impossible de sauvegarder le client",
              icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />,
            })
            setIsSaving(false)
          },
        }
      )
      return
    }

    try {
      const endpoint = `/api/clients/${editingClient.id}`
      const method = "PUT"

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        email: formData.email || undefined,
        internal_notes: formData.internal_notes || undefined,
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save client")
      }

      toast.success("Client mis à jour", {
        description: `${formData.first_name} ${formData.last_name} a été mis à jour avec succès`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      setIsEditDialogOpen(false)
      refetch()
    } catch (error: any) {
      toast.error("Erreur", {
        description: error.message || "Impossible de sauvegarder le client",
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

      if (!response.ok) throw new Error("Failed to delete")

      toast.success("Client supprimé", {
        description: `${client.first_name} ${client.last_name} a été supprimé`,
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />,
      })

      refetch()
    } catch (error) {
      toast.error("Erreur", {
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
                <p className="text-sm text-muted-foreground mb-1">Average Spent</p>
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

        {/* Client List */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-6 bg-muted rounded w-2/3 mb-2" />
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-muted rounded">
                  <div className="h-8 bg-background rounded" />
                  <div className="h-8 bg-background rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client: any) => (
              <Card
                key={client.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleClientClick(client)}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {client.first_name} {client.last_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">Client depuis {new Date(client.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" /> {client.phone}
                  </p>
                  {client.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" /> {client.email}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-muted rounded">
                  <div>
                    <p className="text-muted-foreground text-xs">Visits</p>
                    <p className="font-semibold">{client.visitCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Spent</p>
                    <p className="font-semibold">€{client.totalSpent || 0}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="gap-2 cursor-pointer" onClick={(e) => handleEdit(client, e)}>
                    <Edit className="w-4 h-4" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-2 cursor-pointer" onClick={(e) => handleDelete(client, e)}>
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
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
