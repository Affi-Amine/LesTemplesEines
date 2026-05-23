"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useServices } from "@/lib/hooks/use-services"
import { fetchAPI } from "@/lib/api/client"
import { formatGiftCardCode } from "@/lib/gift-cards"
import { getPaymentMethodLabel } from "@/lib/payments"
import { Ban, CalendarDays, CheckCircle2, Clock3, Gift, Mail, Plus, Search } from "lucide-react"
import { toast } from "sonner"

type GiftCardRow = {
  id: string
  code: string
  buyer_name: string | null
  buyer_email: string
  recipient_email: string | null
  recipient_name: string | null
  personal_message: string | null
  amount_cents: number
  status: "active" | "used" | "cancelled"
  payment_status: "paid" | "unpaid"
  payment_method: string | null
  sold_by?: {
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
  purchased_at: string
  paid_at: string | null
  used_at: string | null
  redeemed_appointment_id: string | null
  service?: {
    id: string
    name: string
    duration_minutes: number
    price_cents: number
  } | null
  appointment?: {
    id: string
    start_time: string
    salon?: {
      id: string
      name: string
      city: string
    } | null
  } | null
}

const statusOptions = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actives" },
  { value: "used", label: "Utilisées" },
  { value: "cancelled", label: "Annulées" },
]

export default function AdminGiftCardsPage() {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [saleOpen, setSaleOpen] = useState(false)
  const [isSelling, setIsSelling] = useState(false)
  const [saleForm, setSaleForm] = useState({
    service_id: "",
    buyer_name: "",
    buyer_email: "",
    recipient_name: "",
    recipient_email: "",
    personal_message: "",
    payment_method: "card",
    send_recipient_email: false,
  })

  const { data: services } = useServices(undefined, true)

  const { data: giftCards, isLoading, refetch } = useQuery({
    queryKey: ["gift-cards", search, status],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (status !== "all") params.append("status", status)
      return fetchAPI<GiftCardRow[]>(`/gift-cards?${params.toString()}`)
    },
  })

  const stats = useMemo(() => {
    const rows = giftCards || []
    return {
      total: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      used: rows.filter((row) => row.status === "used").length,
      revenue: rows.reduce((sum, row) => sum + row.amount_cents, 0) / 100,
    }
  }, [giftCards])

  const getStatusBadge = (value: GiftCardRow["status"]) => {
    switch (value) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case "used":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Utilisée</Badge>
      case "cancelled":
        return <Badge variant="secondary">Annulée</Badge>
    }
  }

  const getPaymentBadge = (value: GiftCardRow["payment_status"]) => {
    if (value === "paid") {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Payee</Badge>
    }

    return <Badge variant="secondary">Non payee</Badge>
  }

  const selectedService = services?.find((service) => service.id === saleForm.service_id)

  const updateSaleForm = (field: keyof typeof saleForm, value: string | boolean) => {
    setSaleForm((current) => ({ ...current, [field]: value }))
  }

  const resetSaleForm = () => {
    setSaleForm({
      service_id: "",
      buyer_name: "",
      buyer_email: "",
      recipient_name: "",
      recipient_email: "",
      personal_message: "",
      payment_method: "card",
      send_recipient_email: false,
    })
  }

  const sellGiftCard = async () => {
    if (!saleForm.service_id) {
      toast.error("Choisis une prestation.")
      return
    }

    try {
      setIsSelling(true)
      await fetchAPI("/gift-cards", {
        method: "POST",
        body: JSON.stringify(saleForm),
      })
      toast.success("Carte cadeau vendue.")
      resetSaleForm()
      setSaleOpen(false)
      refetch()
    } catch (error: any) {
      toast.error(error.message || "Impossible de vendre cette carte cadeau.")
    } finally {
      setIsSelling(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Cartes cadeaux" description="Suivi des cartes cadeaux achetées et utilisées" />

      <div className="space-y-4 p-3 sm:p-6 md:space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setSaleOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Vendre une carte cadeau
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Actives</p>
                <p className="text-2xl font-semibold">{stats.active}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Clock3 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Utilisées</p>
                <p className="text-2xl font-semibold">{stats.used}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Montant cumulé</p>
                <p className="text-2xl font-semibold">{stats.revenue.toFixed(2)}€</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-1 gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Code, email acheteur, email destinataire..."
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setSearch(searchInput)}>Rechercher</Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={status === option.value ? "default" : "outline"}
                  onClick={() => setStatus(option.value)}
                >
                  {option.label}
                </Button>
              ))}
              <Button variant="outline" onClick={() => refetch()}>
                Actualiser
              </Button>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((item) => (
              <Card key={item} className="animate-pulse p-4 sm:p-6">
                <div className="h-5 w-40 bg-muted rounded mb-3" />
                <div className="h-4 w-full bg-muted rounded mb-2" />
                <div className="h-4 w-2/3 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : giftCards && giftCards.length > 0 ? (
          <div className="grid gap-4">
            {giftCards.map((giftCard) => (
              <Card key={giftCard.id} className="p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-mono text-lg">{formatGiftCardCode(giftCard.code)}</p>
                      {getStatusBadge(giftCard.status)}
                      {getPaymentBadge(giftCard.payment_status)}
                    </div>
                    <div>
                      <p className="font-semibold">{giftCard.service?.name || "Prestation inconnue"}</p>
                      <p className="text-sm text-muted-foreground">
                        {(giftCard.amount_cents / 100).toFixed(2)}€{giftCard.service?.duration_minutes ? ` • ${giftCard.service.duration_minutes} min` : ""}
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Acheteur</p>
                        {giftCard.buyer_name && <p>{giftCard.buyer_name}</p>}
                        <p>{giftCard.buyer_email}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Destinataire</p>
                        <p>{giftCard.recipient_name || "-"}</p>
                        <p className="text-muted-foreground">{giftCard.recipient_email || "Pas d'email destinataire"}</p>
                      </div>
                    </div>
                    {giftCard.personal_message && (
                      <div className="rounded-md bg-muted/50 p-3 text-sm">
                        <p className="text-muted-foreground mb-1">Message</p>
                        <p>{giftCard.personal_message}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 lg:min-w-72">
                    <div className="text-sm">
                      <p className="text-muted-foreground">Achetée le</p>
                      <p>{new Date(giftCard.purchased_at).toLocaleString("fr-FR")}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Paiement</p>
                      <p>{giftCard.payment_status === "paid" ? "Paye" : "Non paye"}</p>
                      <p className="text-muted-foreground">{getPaymentMethodLabel(giftCard.payment_method)}</p>
                      {giftCard.paid_at && (
                        <p className="text-muted-foreground">{new Date(giftCard.paid_at).toLocaleString("fr-FR")}</p>
                      )}
                    </div>
                    {giftCard.sold_by && (
                      <div className="text-sm">
                        <p className="text-muted-foreground">Vendu par</p>
                        <p>
                          {[giftCard.sold_by.first_name, giftCard.sold_by.last_name].filter(Boolean).join(" ") ||
                            giftCard.sold_by.email}
                        </p>
                      </div>
                    )}
                    {giftCard.used_at ? (
                      <div className="text-sm">
                        <p className="text-muted-foreground">Utilisée le</p>
                        <p>{new Date(giftCard.used_at).toLocaleString("fr-FR")}</p>
                      </div>
                    ) : (
                      <div className="text-sm flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Disponible pour réservation
                      </div>
                    )}
                    {giftCard.appointment ? (
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium flex items-center gap-2">
                          <CalendarDays className="w-4 h-4" />
                          Rendez-vous lié
                        </p>
                        <p className="mt-1">{new Date(giftCard.appointment.start_time).toLocaleString("fr-FR")}</p>
                        <p className="text-muted-foreground">
                          {giftCard.appointment.salon?.name || "Salon inconnu"}
                          {giftCard.appointment.salon?.city ? ` - ${giftCard.appointment.salon.city}` : ""}
                        </p>
                      </div>
                    ) : giftCard.status === "cancelled" ? (
                      <div className="text-sm flex items-center gap-2 text-muted-foreground">
                        <Ban className="w-4 h-4" />
                        Carte cadeau annulée
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucune carte cadeau</h2>
            <p className="text-muted-foreground">Les cartes cadeaux achetées apparaîtront ici.</p>
          </Card>
        )}
      </div>

      <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vendre une carte cadeau</DialogTitle>
            <DialogDescription>Création immédiate en statut payé, utilisable pour une réservation.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="gift-service">Prestation</Label>
              <select
                id="gift-service"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={saleForm.service_id}
                onChange={(event) => updateSaleForm("service_id", event.target.value)}
              >
                <option value="">Choisir une prestation</option>
                {services?.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {(service.price_cents / 100).toFixed(2)} EUR
                  </option>
                ))}
              </select>
              {selectedService && (
                <p className="text-sm text-muted-foreground">
                  {selectedService.duration_minutes} min - {(selectedService.price_cents / 100).toFixed(2)} EUR
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buyer-name">Nom acheteur</Label>
                <Input
                  id="buyer-name"
                  value={saleForm.buyer_name}
                  onChange={(event) => updateSaleForm("buyer_name", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-email">Email acheteur</Label>
                <Input
                  id="buyer-email"
                  type="email"
                  value={saleForm.buyer_email}
                  onChange={(event) => updateSaleForm("buyer_email", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipient-name">Nom destinataire</Label>
                <Input
                  id="recipient-name"
                  value={saleForm.recipient_name}
                  onChange={(event) => updateSaleForm("recipient_name", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient-email">Email destinataire</Label>
                <Input
                  id="recipient-email"
                  type="email"
                  value={saleForm.recipient_email}
                  onChange={(event) => updateSaleForm("recipient_email", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gift-payment-method">Moyen de paiement</Label>
              <select
                id="gift-payment-method"
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

            <div className="space-y-2">
              <Label htmlFor="gift-message">Message</Label>
              <Textarea
                id="gift-message"
                value={saleForm.personal_message}
                onChange={(event) => updateSaleForm("personal_message", event.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={saleForm.send_recipient_email}
                onCheckedChange={(checked) => updateSaleForm("send_recipient_email", checked === true)}
              />
              Envoyer aussi la carte cadeau au destinataire
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSaleOpen(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={sellGiftCard} disabled={isSelling}>
                {isSelling ? "Vente..." : "Créer la carte"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
