"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AdminHeader } from "@/components/admin-header"
import { GiftCardsSubnav } from "@/components/admin/gift-cards-subnav"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageUpload } from "@/components/ui/image-upload"
import { fetchAPI } from "@/lib/api/client"
import { formatGiftCardCode } from "@/lib/gift-cards"
import { ADDON_ORDER_STATUSES, ADDON_ORDER_STATUS_LABELS, formatEuros, type AddonOrderStatus } from "@/lib/gift-card-addons"
import type { GiftCardAddon, GiftCardAddonOrder } from "@/lib/types/database"
import { Package, Plus, Store, Trash2, Truck, X } from "lucide-react"
import { toast } from "sonner"

const emptyForm = {
  name: "",
  description: "",
  image_url: "",
  price: "0",
  delivery_fee: "0",
  requires_shipping: true,
  extra_fields: [] as { label: string; required: boolean }[],
  is_active: true,
  sort_order: "0",
}

const toCents = (value: string) => Math.round(Number(String(value).replace(",", ".")) * 100) || 0

export default function PhysicalGiftsPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [orderStatus, setOrderStatus] = useState<string>("a_preparer")

  const { data: addons, isLoading } = useQuery({
    queryKey: ["admin-gift-card-addons"],
    queryFn: () => fetchAPI<GiftCardAddon[]>("/gift-card-addons?all=1"),
  })
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["gift-card-addon-orders", orderStatus],
    queryFn: () => fetchAPI<GiftCardAddonOrder[]>(`/gift-card-addon-orders?status=${orderStatus}`),
  })

  useEffect(() => {
    if (!editingId) {
      setForm(emptyForm)
      return
    }
    const addon = addons?.find((item) => item.id === editingId)
    if (!addon) return
    setForm({
      name: addon.name,
      description: addon.description || "",
      image_url: addon.image_url || "",
      price: (addon.price_cents / 100).toFixed(2),
      delivery_fee: (addon.delivery_fee_cents / 100).toFixed(2),
      requires_shipping: addon.requires_shipping,
      extra_fields: addon.extra_fields || [],
      is_active: addon.is_active,
      sort_order: String(addon.sort_order || 0),
    })
  }, [editingId, addons])

  const submitLabel = useMemo(() => (editingId ? "Mettre à jour" : "Ajouter le cadeau"), [editingId])

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Donnez un nom au cadeau.")
      return
    }
    const payload = {
      name: form.name,
      description: form.description || null,
      image_url: form.image_url || null,
      price_cents: toCents(form.price),
      delivery_fee_cents: toCents(form.delivery_fee),
      requires_shipping: form.requires_shipping,
      extra_fields: form.extra_fields.filter((field) => field.label.trim()),
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    }
    try {
      setSaving(true)
      if (editingId) await fetchAPI(`/gift-card-addons/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) })
      else await fetchAPI("/gift-card-addons", { method: "POST", body: JSON.stringify(payload) })
      toast.success("Cadeau physique enregistré.")
      setEditingId(null)
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ["admin-gift-card-addons"] })
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer ce cadeau.")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (addon: GiftCardAddon) => {
    try {
      await fetchAPI(`/gift-card-addons/${addon.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !addon.is_active }) })
      queryClient.invalidateQueries({ queryKey: ["admin-gift-card-addons"] })
    } catch (error: any) {
      toast.error(error.message || "Impossible de modifier ce cadeau.")
    }
  }

  const remove = async (addon: GiftCardAddon) => {
    if (!window.confirm(`Supprimer « ${addon.name} » du catalogue ? Les commandes déjà passées sont conservées.`)) return
    try {
      await fetchAPI(`/gift-card-addons/${addon.id}`, { method: "DELETE" })
      if (editingId === addon.id) setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ["admin-gift-card-addons"] })
    } catch (error: any) {
      toast.error(error.message || "Impossible de supprimer ce cadeau.")
    }
  }

  const updateOrder = async (order: GiftCardAddonOrder, updates: { status?: AddonOrderStatus; notes?: string }) => {
    try {
      await fetchAPI(`/gift-card-addon-orders/${order.id}`, { method: "PATCH", body: JSON.stringify(updates) })
      toast.success("Commande mise à jour.")
      refetchOrders()
    } catch (error: any) {
      toast.error(error.message || "Impossible de mettre à jour la commande.")
    }
  }

  const statusBadge = (status: AddonOrderStatus) => {
    const tone = status === "a_preparer" ? "bg-amber-100 text-amber-800" : status === "expedie" ? "bg-blue-100 text-blue-800" : status === "livre" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
    return <Badge className={`${tone} hover:${tone}`}>{ADDON_ORDER_STATUS_LABELS[status] || status}</Badge>
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Cadeaux physiques" description="Ce que le client peut joindre à sa carte cadeau en ligne : coffret, carte imprimée, bougie… avec livraison" />
      <div className="space-y-4 p-3 sm:p-6 md:space-y-6">
        <GiftCardsSubnav />

        <Tabs defaultValue="catalogue">
          <TabsList>
            <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
            <TabsTrigger value="commandes">Commandes{orders?.length ? ` (${orders.length})` : ""}</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogue" className="space-y-4 pt-4 md:space-y-6">
            <Card className="space-y-5 p-4 sm:p-6">
              <h2 className="text-lg font-semibold">{editingId ? "Modifier le cadeau" : "Nouveau cadeau physique"}</h2>
              <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="addon-name">Nom</Label>
                      <Input id="addon-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Coffret carte cadeau imprimée" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addon-price">Prix (€)</Label>
                      <Input id="addon-price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addon-description">Description</Label>
                    <Textarea id="addon-description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ce que contient le cadeau, ses dimensions, le délai de préparation…" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-1">
                      <span className="text-sm font-medium">Livré par la poste</span>
                      <Switch checked={form.requires_shipping} onCheckedChange={(checked) => setForm({ ...form, requires_shipping: checked })} />
                    </label>
                    <div className="space-y-2">
                      <Label htmlFor="addon-delivery">Frais de livraison (€)</Label>
                      <Input id="addon-delivery" type="number" min="0" step="0.01" value={form.delivery_fee} disabled={!form.requires_shipping} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addon-order">Ordre d&apos;affichage</Label>
                      <Input id="addon-order" type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                    </div>
                  </div>
                  {!form.requires_shipping && <p className="text-xs text-muted-foreground">Sans livraison : le cadeau est remis au salon, aucune adresse n&apos;est demandée au client.</p>}

                  <div className="space-y-2">
                    <Label>Informations à demander au client</Label>
                    <p className="text-xs text-muted-foreground">Une question par ligne, posée au moment de l&apos;achat (couleur, taille, texte à graver…).</p>
                    {form.extra_fields.map((field, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input value={field.label} placeholder="Couleur du ruban" onChange={(e) => setForm({ ...form, extra_fields: form.extra_fields.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)) })} />
                        <label className="flex shrink-0 items-center gap-2 text-sm"><Switch checked={field.required} onCheckedChange={(checked) => setForm({ ...form, extra_fields: form.extra_fields.map((item, i) => (i === index ? { ...item, required: checked } : item)) })} />Obligatoire</label>
                        <Button type="button" variant="ghost" size="icon" aria-label="Retirer" onClick={() => setForm({ ...form, extra_fields: form.extra_fields.filter((_, i) => i !== index) })}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {form.extra_fields.length < 6 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, extra_fields: [...form.extra_fields, { label: "", required: false }] })}><Plus className="mr-2 h-4 w-4" />Ajouter une question</Button>
                    )}
                  </div>

                  <label className="flex items-center gap-3 text-sm"><Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />Proposé sur la page carte cadeau</label>
                </div>
                <div className="space-y-2">
                  <Label>Photo</Label>
                  <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} bucketName="service-images" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : submitLabel}</Button>
                {editingId && <Button variant="outline" onClick={() => setEditingId(null)}>Annuler</Button>}
              </div>
            </Card>

            <div className="grid gap-4">
              {isLoading ? (
                [1, 2].map((item) => <Card key={item} className="h-28 animate-pulse p-4" />)
              ) : addons?.length ? addons.map((addon) => (
                <Card key={addon.id} className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex gap-4">
                      {addon.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={addon.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted"><Package className="h-7 w-7 text-muted-foreground" /></div>
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{addon.name}</h3>
                          {!addon.is_active && <Badge variant="secondary">Masqué</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatEuros(addon.price_cents)} · {addon.requires_shipping ? <><Truck className="inline h-3.5 w-3.5" /> livraison {addon.delivery_fee_cents ? formatEuros(addon.delivery_fee_cents) : "offerte"}</> : <><Store className="inline h-3.5 w-3.5" /> retrait au salon</>}
                          {addon.extra_fields?.length ? ` · ${addon.extra_fields.length} question${addon.extra_fields.length > 1 ? "s" : ""}` : ""}
                        </p>
                        {addon.description && <p className="mt-1 text-sm text-muted-foreground">{addon.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setEditingId(addon.id)}>Modifier</Button>
                      <Button variant={addon.is_active ? "secondary" : "default"} onClick={() => toggleActive(addon)}>{addon.is_active ? "Masquer" : "Proposer"}</Button>
                      <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => remove(addon)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </Card>
              )) : (
                <Card className="p-10 text-center text-sm text-muted-foreground">Aucun cadeau physique pour l&apos;instant : la page carte cadeau n&apos;en propose pas tant que le catalogue est vide.</Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="commandes" className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              {["a_preparer", "expedie", "livre", "annule", "all"].map((value) => (
                <Button key={value} size="sm" variant={orderStatus === value ? "default" : "outline"} onClick={() => setOrderStatus(value)}>
                  {value === "all" ? "Toutes" : ADDON_ORDER_STATUS_LABELS[value as AddonOrderStatus]}
                </Button>
              ))}
            </div>
            {ordersLoading ? (
              <Card className="h-28 animate-pulse p-4" />
            ) : orders?.length ? orders.map((order) => (
              <Card key={order.id} className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{order.addon_name}{order.quantity > 1 ? ` × ${order.quantity}` : ""}</h3>
                      {statusBadge(order.status)}
                      <span className="text-sm text-muted-foreground">{formatEuros(order.addon_price_cents * order.quantity + order.delivery_fee_cents)}{order.delivery_fee_cents ? ` (dont livraison ${formatEuros(order.delivery_fee_cents)})` : ""}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Commandé le {new Date(order.created_at).toLocaleString("fr-FR")} · carte <span className="font-mono">{order.gift_card ? formatGiftCardCode(order.gift_card.code) : "?"}</span>
                      {order.gift_card?.service?.name ? ` · ${order.gift_card.service.name}` : ""}
                    </p>
                    <p className="text-sm">Acheteur : {order.gift_card?.buyer_name || "—"} · {order.gift_card?.buyer_email}</p>
                    {order.shipping ? (
                      <div className="rounded-md bg-muted/50 p-3 text-sm">
                        <p className="mb-1 flex items-center gap-1.5 font-medium"><Truck className="h-4 w-4" />Livraison</p>
                        <p>{order.shipping.name} · {order.shipping.phone}</p>
                        <p>{order.shipping.line1}{order.shipping.line2 ? `, ${order.shipping.line2}` : ""}</p>
                        <p>{order.shipping.postal_code} {order.shipping.city}, {order.shipping.country}</p>
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Store className="h-4 w-4" />À remettre au salon</p>
                    )}
                    {Object.entries(order.extra_answers || {}).filter(([, value]) => value).length > 0 && (
                      <ul className="text-sm">
                        {Object.entries(order.extra_answers).filter(([, value]) => value).map(([label, value]) => <li key={label}><span className="text-muted-foreground">{label} :</span> {value}</li>)}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-3 lg:min-w-64">
                    <div className="space-y-1">
                      <Label htmlFor={`status-${order.id}`}>Statut</Label>
                      <select id={`status-${order.id}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={order.status} onChange={(e) => updateOrder(order, { status: e.target.value as AddonOrderStatus })}>
                        {ADDON_ORDER_STATUSES.map((status) => <option key={status} value={status}>{ADDON_ORDER_STATUS_LABELS[status]}</option>)}
                      </select>
                      {order.shipped_at && <p className="text-xs text-muted-foreground">Expédié le {new Date(order.shipped_at).toLocaleDateString("fr-FR")}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`notes-${order.id}`}>Notes (n° de suivi…)</Label>
                      <Textarea id={`notes-${order.id}`} rows={2} defaultValue={order.notes || ""} onBlur={(e) => { if ((e.target.value || "") !== (order.notes || "")) updateOrder(order, { notes: e.target.value }) }} />
                    </div>
                  </div>
                </div>
              </Card>
            )) : (
              <Card className="p-10 text-center text-sm text-muted-foreground">Aucune commande {orderStatus === "all" ? "" : `« ${ADDON_ORDER_STATUS_LABELS[orderStatus as AddonOrderStatus]?.toLowerCase()} »`}.</Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
