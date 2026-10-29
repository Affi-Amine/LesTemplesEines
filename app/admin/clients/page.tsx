"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClientSearch } from "@/components/client-search"
import { ClientDetailsModal } from "@/components/client-details-modal"
import { Mail, Phone, TrendingUp, User, Plus, Edit, Trash2 } from "lucide-react"
import { useState, useMemo, useEffect, useRef } from "react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { ClientProfileFormSchema } from "@/lib/clients/profile"
import { useCreateClient } from "@/lib/hooks/use-create-client"

export default function ClientsPage() {
  const { t } = useTranslations()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClient, setSelectedClient] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<any | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [returnToDetails, setReturnToDetails] = useState(false)
  const [isOpeningEdit, setIsOpeningEdit] = useState(false)
  const submitLock = useRef(false), editLoadLock = useRef(false)
  const queryClient = useQueryClient()
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250); return () => clearTimeout(timer) }, [searchQuery])

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
    queryKey: ["clients", { search: debouncedSearch }],
    queryFn: ({ signal }) => fetchAPI<any[]>(`/clients?limit=50${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`, { signal, cache: "no-store" }),
    refetchOnMount: "always",
  })

  const createClient = useCreateClient()

  const filteredClients = useMemo(() => {
    if (!clients) return []
    const filtered = [...clients]
    // Newest first by created_at
    return filtered.sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [clients])

  const handleClientClick = (client: any) => {
    setSelectedClient(client)
    setModalOpen(true)
  }

  const handleEdit = async (client: any, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (editLoadLock.current) return
    editLoadLock.current = true; setIsOpeningEdit(true)
    try {
      const latest = await fetchAPI<any>(`/clients/${client.id}`, { cache: "no-store" })
      setSelectedClient((current: any) => current?.id === latest.id ? { ...current, ...latest } : current)
      setEditingClient(latest)
      setReturnToDetails(!e)
      setModalOpen(false)
      setFormError("")
      setFormData({ first_name: latest.first_name || "", last_name: latest.last_name || "", phone: latest.phone || "", email: latest.email || "", internal_notes: latest.internal_notes || "" })
      setIsEditDialogOpen(true)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossible d’ouvrir cette fiche.") }
    finally { editLoadLock.current = false; setIsOpeningEdit(false) }
  }

  const closeEditor = () => {
    if (submitLock.current) return
    setIsEditDialogOpen(false); setFormError("")
    if (returnToDetails && selectedClient) setModalOpen(true)
  }

  const handleCreate = () => {
    setReturnToDetails(false); setFormError("")
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
    if (submitLock.current) return
    const parsed = ClientProfileFormSchema.safeParse(formData)
    if (!parsed.success) { setFormError(parsed.error.issues[0]?.message || "Vérifiez les informations saisies."); return }
    submitLock.current = true; setIsSaving(true); setFormError("")
    try {
      const values = parsed.data
      const saved = editingClient
        ? await fetchAPI<any>(`/clients/${editingClient.id}`, { method: "PUT", body: JSON.stringify({ ...values, expected_updated_at: editingClient.updated_at || null }) })
        : await createClient.mutateAsync({ ...values, email: values.email || undefined, internal_notes: values.internal_notes || undefined })
      queryClient.setQueriesData<any[]>({ queryKey: ["clients"] }, old => Array.isArray(old) ? old.map(client => client.id === saved.id ? { ...client, ...saved } : client) : old)
      if (editingClient?.phone && editingClient.phone !== saved.phone) queryClient.removeQueries({ queryKey: ["client", "phone"] })
      queryClient.setQueryData(["client", "phone", saved.phone], saved)
      setSelectedClient((current: any) => current?.id === saved.id ? { ...current, ...saved } : current)
      await Promise.all(["clients", "client", "appointments", "staff-appointments", "client-packs", "booking-client-packs"].map(key => queryClient.invalidateQueries({ queryKey: [key] })))
      setIsEditDialogOpen(false)
      if (returnToDetails) { setSelectedClient((current: any) => ({ ...current, ...saved })); setModalOpen(true) }
      toast.success(editingClient ? "Fiche client mise à jour" : "Client créé")
    } catch (error) { setFormError(error instanceof Error ? error.message : "Impossible d’enregistrer la fiche. Réessayez.") }
    finally { submitLock.current = false; setIsSaving(false) }
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

      <div className="space-y-4 p-3 sm:p-6 md:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-xl font-bold sm:text-2xl">{t("admin.clients")}</h2>
          <Button onClick={handleCreate} className="shrink-0 gap-2 cursor-pointer">
            <Plus className="w-4 h-4" />
            {t("common.add")}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          <Card className="p-4 sm:p-6">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground mb-1">{t("admin.total_clients")}</p>
                {isLoading ? (
                  <div className="h-9 w-16 bg-muted rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold sm:text-3xl">{totalClients}</p>
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-4 sm:p-6">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground mb-1">{t("admin.total_revenue")}</p>
                {isLoading ? (
                  <div className="h-9 w-20 bg-muted rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold sm:text-3xl">€{totalRevenue}</p>
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-4 sm:p-6">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground mb-1">Dépense moyenne</p>
                {isLoading ? (
                  <div className="h-9 w-16 bg-muted rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold sm:text-3xl">€{avgSpent}</p>
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <ClientSearch onSearch={setSearchQuery} onCreate={handleCreate} />
        {isOpeningEdit && <p role="status" className="text-sm text-muted-foreground">Ouverture de la fiche…</p>}

        {/* Liste des clients */}
        {isLoading || searchQuery.trim() !== debouncedSearch ? (
          <Card className="overflow-hidden">
            <div className="grid divide-y md:grid-cols-2 md:divide-x 2xl:hidden">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="space-y-2 p-4">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-full animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto 2xl:block">
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
            <div className="grid divide-y md:grid-cols-2 md:divide-x 2xl:hidden">
              {filteredClients.map((client: any) => (
                <div
                  key={client.id}
                  role="button" tabIndex={0}
                  className="w-full cursor-pointer space-y-3 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                  onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); handleClientClick(client) } }}
                  onClick={() => handleClientClick(client)}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{client.first_name} {client.last_name}</div>
                      <div className="mt-1 truncate text-sm text-muted-foreground">{client.phone || "Téléphone manquant"}</div>
                      <div className="truncate text-xs text-muted-foreground">{client.email || "E-mail manquant"}</div>
                    </div>
                    <div className="shrink-0 rounded-md border px-2 py-1 text-center">
                      <div className="text-sm font-bold">{client.visit_count ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">visites</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Dernière visite</span>
                    <span>{client.last_visit_date ? new Date(client.last_visit_date).toLocaleDateString("fr-FR") : "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="gap-2" onClick={(e) => handleEdit(client, e)}>
                      <Edit className="h-4 w-4" /> Modifier
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-2" onClick={(e) => handleDelete(client, e)}>
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </Button>
                  </div>
                </div>
              ))}
              {filteredClients.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucun client</div>
              ) : null}
            </div>
            <div className="hidden overflow-x-auto 2xl:block">
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
                      <td className="px-3 md:px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-2">
                          <Button variant="outline" size="sm" className="gap-1 sm:gap-2 cursor-pointer text-xs sm:text-sm" onClick={(e) => handleEdit(client, e)}>
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Modifier</span>
                          </Button>
                          <Button variant="destructive" size="sm" className="gap-1 sm:gap-2 cursor-pointer text-xs sm:text-sm" onClick={(e) => handleDelete(client, e)}>
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Supprimer</span>
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
          <ClientDetailsModal open={modalOpen} onOpenChange={setModalOpen} client={selectedClient} onEdit={() => void handleEdit(selectedClient)} isOpeningEdit={isOpeningEdit} />
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={open => { if (!open) closeEditor() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? "Modifier le client" : "Ajouter un client"}</DialogTitle>
              <DialogDescription>
                {editingClient
                  ? "Mettez à jour les informations du client"
                  : "Ajoutez un nouveau client à votre base de données"}
              </DialogDescription>
            </DialogHeader>

            <form id="client-profile-form" noValidate onSubmit={event => { event.preventDefault(); void handleSave() }}>
            <fieldset disabled={isSaving} className="space-y-4">
              {formError && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">{formError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    id="firstName" autoComplete="given-name" maxLength={100} required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input id="lastName" autoComplete="family-name" maxLength={100} required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Téléphone *</Label>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={32} required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="email">Email de contact (optionnel)</Label>
                <Input id="email" type="email" autoComplete="email" maxLength={255} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="notes">Notes internes (optionnel)</Label>
                <Textarea id="notes" maxLength={5000} value={formData.internal_notes} onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })} />
              </div>
              {editingClient?.auth_user_id && <p className="text-xs leading-5 text-muted-foreground">Ces coordonnées servent à contacter le client. L’adresse de connexion à son compte reste inchangée.</p>}
            </fieldset>
            </form>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditor} disabled={isSaving} className="cursor-pointer">Annuler</Button>
              <Button type="submit" form="client-profile-form" className="cursor-pointer" disabled={isSaving}>
                {isSaving ? "Sauvegarde..." : editingClient ? "Sauvegarder" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
