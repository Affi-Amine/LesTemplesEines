"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { fetchAPI } from "@/lib/api/client"
import { getPaymentMethodLabel } from "@/lib/payments"
import type { ClientPack, Pack } from "@/lib/types/database"
import { Plus } from "lucide-react"
import { toast } from "sonner"

const statusOptions = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "partially_paid", label: "Paiement en cours" },
  { value: "paid", label: "Payés" },
  { value: "failed", label: "Impayés" },
  { value: "cancelled", label: "Annulés" },
] as const

const editableStatusOptions: Array<{ value: ClientPack["payment_status"]; label: string }> = [
  { value: "pending", label: "En attente" },
  { value: "active", label: "Actif" },
  { value: "partially_paid", label: "Paiement en cours" },
  { value: "paid", label: "Payé" },
  { value: "failed", label: "Impayé" },
  { value: "cancelled", label: "Annulé" },
]

function getPaymentStatusLabel(status: ClientPack["payment_status"]) {
  switch (status) {
    case "paid":
      return "Payé"
    case "active":
      return "Actif"
    case "partially_paid":
      return "Paiement en cours"
    case "pending":
      return "En attente"
    case "failed":
      return "Impayé"
    case "cancelled":
      return "Annulé"
    default:
      return status
  }
}

function getPaymentStatusClass(status: ClientPack["payment_status"]) {
  switch (status) {
    case "failed":
      return "border-red-200 bg-red-50 text-red-700"
    case "cancelled":
      return "border-slate-200 bg-slate-100 text-slate-700"
    case "partially_paid":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "active":
      return "border-primary/20 bg-primary/10 text-primary"
    default:
      return "border-border bg-muted text-foreground"
  }
}

export default function AdminClientPacksPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>("all")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [statusDrafts, setStatusDrafts] = useState<Record<string, ClientPack["payment_status"]>>({})
  const [saleOpen, setSaleOpen] = useState(false)
  const [isSelling, setIsSelling] = useState(false)
  const [saleForm, setSaleForm] = useState({
    pack_id: "",
    client_first_name: "",
    client_last_name: "",
    client_phone: "",
    client_email: "",
    installment_count: 1,
    paid_installments: 1,
    payment_method: "card",
    send_email: true,
  })

  const { data: clientPacks, isLoading } = useQuery({
    queryKey: ["admin-client-packs", search, status],
    queryFn: () =>
      fetchAPI<ClientPack[]>(
        `/client-packs?${new URLSearchParams({
          ...(search ? { search } : {}),
          ...(status !== "all" ? { status } : {}),
        }).toString()}`
      ),
  })

  const { data: packs } = useQuery({
    queryKey: ["packs", "active"],
    queryFn: () => fetchAPI<Pack[]>("/packs?active=true"),
  })

  const selectedPack = packs?.find((pack) => pack.id === saleForm.pack_id)

  const updateSaleForm = (field: keyof typeof saleForm, value: string | number | boolean) => {
    setSaleForm((current) => ({ ...current, [field]: value }))
  }

  const selectPack = (packId: string) => {
    const nextPack = packs?.find((pack) => pack.id === packId)
    const nextInstallmentCount = nextPack?.allowed_installments?.[0] || 1
    setSaleForm((current) => ({
      ...current,
      pack_id: packId,
      installment_count: nextInstallmentCount,
      paid_installments: nextInstallmentCount,
    }))
  }

  const resetSaleForm = () => {
    setSaleForm({
      pack_id: "",
      client_first_name: "",
      client_last_name: "",
      client_phone: "",
      client_email: "",
      installment_count: 1,
      paid_installments: 1,
      payment_method: "card",
      send_email: true,
    })
  }

  const sellClientPack = async () => {
    if (!saleForm.pack_id) {
      toast.error("Choisis un pack.")
      return
    }

    try {
      setIsSelling(true)
      await fetchAPI("/client-packs", {
        method: "POST",
        body: JSON.stringify(saleForm),
      })
      toast.success("Pack vendu au client.")
      resetSaleForm()
      setSaleOpen(false)
      queryClient.invalidateQueries({ queryKey: ["admin-client-packs"] })
    } catch (error: any) {
      toast.error(error.message || "Impossible de vendre ce pack.")
    } finally {
      setIsSelling(false)
    }
  }

  const saveClientPack = async (clientPack: ClientPack) => {
    try {
      const nextValue = Number(drafts[clientPack.id] ?? clientPack.remaining_sessions)
      const nextStatus = statusDrafts[clientPack.id] ?? clientPack.payment_status
      await fetchAPI(`/client-packs/${clientPack.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          remaining_sessions: nextValue,
          payment_status: nextStatus,
        }),
      })
      toast.success("Forfait client mis à jour.")
      queryClient.invalidateQueries({ queryKey: ["admin-client-packs"] })
    } catch (error: any) {
      toast.error(error.message || "Impossible de mettre à jour le forfait client.")
    }
  }

  const failedCount = clientPacks?.filter((clientPack) => clientPack.payment_status === "failed").length || 0

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Packs clients" description="Suivi des forfaits vendus, restants et consommés" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setSaleOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Vendre un pack
          </Button>
        </div>

        {failedCount > 0 && (
          <Card className="border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">Alerte impayés</p>
            <p className="mt-1 text-sm text-red-700">
              {failedCount} forfait(s) client(s) sont actuellement bloqués suite à un échec de mensualité.
            </p>
          </Card>
        )}

        <Card className="space-y-4 p-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client ou un pack" />
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={status === option.value ? "default" : "outline"}
                onClick={() => setStatus(option.value)}
                className="h-9"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </Card>

        {isLoading ? (
          [1, 2].map((item) => <Card key={item} className="p-6 animate-pulse h-32" />)
        ) : (
          <div className="grid gap-4">
            {clientPacks?.map((clientPack) => (
              <Card key={clientPack.id} className="p-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{clientPack.pack?.name || "Pack"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {clientPack.client?.first_name} {clientPack.client?.last_name} • {clientPack.client?.email || "Sans email"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {clientPack.client?.phone || "Téléphone non renseigné"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Achat: {new Date(clientPack.purchase_date).toLocaleDateString("fr-FR")} • Échéances payées: {clientPack.paid_installments || 0} / {clientPack.installment_count || 1}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Paiement: {getPaymentMethodLabel(clientPack.payment_method)}
                    </p>
                    {clientPack.sold_by && (
                      <p className="text-sm text-muted-foreground">
                        Vendu par: {[clientPack.sold_by.first_name, clientPack.sold_by.last_name].filter(Boolean).join(" ") || clientPack.sold_by.email}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${getPaymentStatusClass(clientPack.payment_status)}`}>
                      {getPaymentStatusLabel(clientPack.payment_status)}
                    </div>
                    <Input
                      type="number"
                      className="w-24"
                      value={drafts[clientPack.id] ?? String(clientPack.remaining_sessions)}
                      onChange={(e) => setDrafts((current) => ({ ...current, [clientPack.id]: e.target.value }))}
                    />
                    <select
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      value={statusDrafts[clientPack.id] ?? clientPack.payment_status}
                      onChange={(e) =>
                        setStatusDrafts((current) => ({
                          ...current,
                          [clientPack.id]: e.target.value as ClientPack["payment_status"],
                        }))
                      }
                    >
                      {editableStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Button onClick={() => saveClientPack(clientPack)}>Enregistrer</Button>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground sm:grid-cols-3">
                  <p>Restant : <span className="font-medium text-foreground">{clientPack.remaining_sessions} / {clientPack.total_sessions}</span></p>
                  <p>Abonnement Stripe : <span className="font-medium text-foreground break-all">{clientPack.stripe_subscription_id || "Aucun"}</span></p>
                  <p>Statut actuel : <span className="font-medium text-foreground">{getPaymentStatusLabel(clientPack.payment_status)}</span></p>
                </div>

                {clientPack.usages && clientPack.usages.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <p className="font-medium mb-3">Historique</p>
                    <div className="space-y-2 text-sm">
                      {clientPack.usages.map((usage) => (
                        <div key={usage.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <span>{usage.appointment?.service?.name || "Prestation"} • {usage.appointment?.salon?.name || "Salon"}</span>
                          <span className="text-muted-foreground">{new Date(usage.used_at).toLocaleString("fr-FR")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vendre un pack</DialogTitle>
            <DialogDescription>Ajoute le pack directement au compte client, sans paiement Stripe.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="pack-sale-pack">Pack</Label>
              <select
                id="pack-sale-pack"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={saleForm.pack_id}
                onChange={(event) => selectPack(event.target.value)}
              >
                <option value="">Choisir un pack</option>
                {packs?.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name} - {Number(pack.price).toFixed(2)} EUR
                  </option>
                ))}
              </select>
              {selectedPack && (
                <p className="text-sm text-muted-foreground">
                  {selectedPack.number_of_sessions} séance(s) - échéances autorisées: {selectedPack.allowed_installments.join(", ")}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-first-name">Prénom</Label>
                <Input
                  id="client-first-name"
                  value={saleForm.client_first_name}
                  onChange={(event) => updateSaleForm("client_first_name", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-last-name">Nom</Label>
                <Input
                  id="client-last-name"
                  value={saleForm.client_last_name}
                  onChange={(event) => updateSaleForm("client_last_name", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-phone">Téléphone</Label>
                <Input
                  id="client-phone"
                  value={saleForm.client_phone}
                  onChange={(event) => updateSaleForm("client_phone", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={saleForm.client_email}
                  onChange={(event) => updateSaleForm("client_email", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="installments">Échéances prévues</Label>
                <select
                  id="installments"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={saleForm.installment_count}
                  onChange={(event) => {
                    const installmentCount = Number(event.target.value)
                    updateSaleForm("installment_count", installmentCount)
                    updateSaleForm("paid_installments", installmentCount)
                  }}
                >
                  {(selectedPack?.allowed_installments || [1]).map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid-installments">Échéances encaissées</Label>
                <select
                  id="paid-installments"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={saleForm.paid_installments}
                  onChange={(event) => updateSaleForm("paid_installments", Number(event.target.value))}
                >
                  {Array.from({ length: saleForm.installment_count + 1 }, (_, index) => (
                    <option key={index} value={index}>
                      {index}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pack-payment-method">Moyen de paiement</Label>
              <select
                id="pack-payment-method"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={saleForm.payment_method}
                onChange={(event) => updateSaleForm("payment_method", event.target.value)}
              >
                <option value="card">Carte bancaire</option>
                <option value="cash">Especes</option>
                <option value="check">Cheque</option>
                <option value="on_site">Sur place</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={saleForm.send_email}
                onCheckedChange={(checked) => updateSaleForm("send_email", checked === true)}
              />
              Envoyer l'email de confirmation si un email est renseigné
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSaleOpen(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={sellClientPack} disabled={isSelling}>
                {isSelling ? "Vente..." : "Créer le pack client"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
