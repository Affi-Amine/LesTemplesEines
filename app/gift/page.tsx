"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ServiceCatalog } from "@/components/service-catalog"
import { useServices } from "@/lib/hooks/use-services"
import { fetchAPI } from "@/lib/api/client"
import { formatGiftCardCode, isGiftCardEligible } from "@/lib/gift-cards"
import { formatEuros, MAX_ADDON_QUANTITY, priceGiftCardOrder } from "@/lib/gift-card-addons"
import type { GiftCardAddon } from "@/lib/types/database"
import { Mail, Gift, Package, Truck, Store, Minus, Plus, Check } from "lucide-react"
import { toast } from "sonner"

type CheckoutStatus = {
  session_id: string
  checkout_type: "gift_card" | "appointment"
  status: "open" | "completed" | "failed"
  payload?: {
    buyer_name: string | null
  } | null
  gift_card?: {
    code: string
    recipient_email: string | null
  } | null
}

const EMPTY_SHIPPING = { name: "", phone: "", line1: "", line2: "", postal_code: "", city: "", country: "France" }

function GiftPageContent() {
  const searchParams = useSearchParams()
  const { data: services, isLoading } = useServices(undefined, true)
  const sessionId = searchParams.get("session_id")
  const checkoutState = searchParams.get("checkout")

  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    buyer_name: "",
    buyer_email: "",
    recipient_email: "",
    recipient_name: "",
    personal_message: "",
  })

  // Physical extras, offered in a dialog right before payment (gift cards only).
  const { data: addons } = useQuery({
    queryKey: ["gift-card-addons"],
    queryFn: () => fetchAPI<GiftCardAddon[]>("/gift-card-addons"),
    staleTime: 60_000,
  })
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [addonId, setAddonId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [shipping, setShipping] = useState(EMPTY_SHIPPING)
  const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({})

  // Limited-time offers are not sold as gift cards: they would be redeemed
  // once the offer is over, at a price the salons no longer practise.
  const giftableServices = useMemo(
    () => (services || []).filter(isGiftCardEligible),
    [services]
  )

  const selectedService = useMemo(
    () => giftableServices.find((service) => service.id === selectedServiceId),
    [giftableServices, selectedServiceId]
  )
  const selectedAddon = useMemo(() => (addons || []).find((addon) => addon.id === addonId) || null, [addons, addonId])
  const priced = useMemo(
    () => priceGiftCardOrder(selectedService?.price_cents || 0, selectedAddon, quantity),
    [selectedService, selectedAddon, quantity]
  )

  const { data: checkoutStatus } = useQuery({
    queryKey: ["gift-checkout-status", sessionId],
    queryFn: () => fetchAPI<CheckoutStatus>(`/stripe/checkout-status?session_id=${sessionId}`),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => query.state.data?.status === "open" ? 3000 : false,
  })

  useEffect(() => {
    if (checkoutState === "cancel") {
      toast.error("Le paiement a été annulé.")
    }
  }, [checkoutState])

  useEffect(() => {
    // A new extra starts with its own answers; the address is kept between tries.
    setExtraAnswers({})
    setQuantity(1)
  }, [addonId])

  const canSubmit = Boolean(selectedService && form.buyer_name && form.buyer_email)

  const startPayment = async (withAddon: boolean) => {
    if (!selectedService || !form.buyer_email) {
      toast.error("Veuillez choisir une prestation et renseigner le nom et l'email de l'offrant.")
      return
    }
    if (withAddon && selectedAddon) {
      if (selectedAddon.requires_shipping) {
        const missing = (["name", "phone", "line1", "postal_code", "city"] as const).find((key) => !shipping[key].trim())
        if (missing) {
          toast.error("Complétez l'adresse de livraison du cadeau physique.")
          return
        }
      }
      const unanswered = (selectedAddon.extra_fields || []).find((field) => field.required && !(extraAnswers[field.label] || "").trim())
      if (unanswered) {
        toast.error(`Précisez « ${unanswered.label} ».`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const response = await fetchAPI<{ url: string }>("/gift-cards/purchase", {
        method: "POST",
        body: JSON.stringify({
          service_id: selectedService.id,
          buyer_name: form.buyer_name,
          buyer_email: form.buyer_email,
          recipient_email: form.recipient_email || undefined,
          recipient_name: form.recipient_name || undefined,
          personal_message: form.personal_message || undefined,
          addon: withAddon && selectedAddon
            ? {
                addon_id: selectedAddon.id,
                quantity,
                shipping: selectedAddon.requires_shipping ? { ...shipping, line2: shipping.line2 || undefined } : undefined,
                extra_answers: extraAnswers,
              }
            : undefined,
        }),
      })

      window.location.href = response.url
    } catch (error: any) {
      toast.error(error.message || "Impossible de générer la carte cadeau.")
      setIsSubmitting(false)
    }
  }

  const handlePurchase = () => {
    if (!canSubmit) {
      toast.error("Veuillez choisir une prestation et renseigner le nom et l'email de l'offrant.")
      return
    }
    // Nothing physical on offer: straight to payment, as before.
    if (!addons?.length) {
      void startPayment(false)
      return
    }
    setExtrasOpen(true)
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="px-4 pb-12 pt-[5.5rem] sm:pb-16 sm:pt-28">
        <div className="max-w-6xl mx-auto space-y-5 sm:space-y-8">
          <div className="space-y-3 text-left sm:space-y-4 sm:text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-[11px] font-medium text-primary sm:px-4 sm:py-2 sm:text-sm">
              <Gift className="w-4 h-4" />
              Cartes cadeaux
            </span>
            <h1 className="text-2xl font-serif font-semibold leading-tight sm:text-4xl md:text-5xl md:font-bold">Offrir une expérience Les Temples</h1>
            <p className="max-w-2xl text-[0.82rem] leading-6 text-muted-foreground sm:mx-auto sm:text-base sm:leading-7">
              Choisissez une prestation, ajoutez un message, puis finalisez la carte cadeau en ligne.
              {addons?.length ? " Vous pourrez y joindre un cadeau physique livré chez vous." : ""}
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] lg:gap-8">
            <div className="min-w-0 space-y-3 sm:space-y-6">
              <h2 className="text-base font-semibold sm:text-2xl">1. Choisir une prestation</h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="rounded-xl border border-primary/10 p-4 animate-pulse">
                      <div className="h-4 w-2/3 bg-muted rounded mb-3" />
                      <div className="h-3 w-full bg-muted rounded mb-2" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <ServiceCatalog
                  services={giftableServices}
                  selectedServiceId={selectedServiceId}
                  onSelectService={setSelectedServiceId}
                  compact
                />
              )}
            </div>

            <Card className="min-w-0 gap-3.5 space-y-0 rounded-xl border-primary/10 bg-card/60 px-3.5 py-4 shadow-none sm:gap-4 sm:space-y-5 sm:p-6 lg:sticky lg:top-24">
              <h2 className="text-base font-semibold sm:text-2xl">2. Informations d&apos;envoi</h2>

              {selectedService ? (
                <div className="rounded-xl border border-primary/10 bg-background/28 p-3.5 sm:p-4">
                  <p className="text-sm text-muted-foreground">Prestation sélectionnée</p>
                  <p className="break-words font-semibold">{selectedService.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedService.duration_minutes} min</p>
                  <p className="text-lg font-bold text-primary mt-2">{(selectedService.price_cents / 100).toFixed(2)}€</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-primary/15 p-3.5 text-sm text-muted-foreground sm:p-4">
                  Sélectionne d&apos;abord une prestation dans la liste.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="buyer_name">Nom de l&apos;offrant *</Label>
                <Input
                  id="buyer_name"
                  value={form.buyer_name}
                  onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                  placeholder="Prénom Nom"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer_email">Email acheteur *</Label>
                <Input
                  id="buyer_email"
                  type="email"
                  value={form.buyer_email}
                  onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
                  placeholder="acheteur@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient_email">Email destinataire</Label>
                <Input
                  id="recipient_email"
                  type="email"
                  value={form.recipient_email}
                  onChange={(e) => setForm({ ...form, recipient_email: e.target.value })}
                  placeholder="destinataire@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient_name">Nom destinataire</Label>
                <Input
                  id="recipient_name"
                  value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                  placeholder="Prénom Nom"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personal_message">Message personnalisé</Label>
                <Textarea
                  id="personal_message"
                  value={form.personal_message}
                  onChange={(e) => setForm({ ...form, personal_message: e.target.value })}
                  rows={5}
                  placeholder="Un mot pour accompagner votre cadeau..."
                />
              </div>

              <Button onClick={handlePurchase} disabled={!canSubmit || isSubmitting} className="w-full">
                {isSubmitting ? "Redirection vers Stripe..." : addons?.length ? "Continuer" : "Payer"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Le paiement en ligne est obligatoire. La carte cadeau sera créée uniquement après confirmation Stripe.
              </p>

              {checkoutStatus?.status === "open" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <p className="font-medium text-amber-800">Paiement confirmé, finalisation en cours</p>
                  <p className="text-sm text-amber-700">Nous attendons la confirmation finale de Stripe avant de générer la carte cadeau.</p>
                </div>
              )}

              {checkoutStatus?.status === "completed" && checkoutStatus.gift_card && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <Mail className="w-4 h-4" />
                    Carte cadeau générée
                  </div>
                  <p className="text-sm">Code cadeau</p>
                  <p className="font-mono text-lg">{formatGiftCardCode(checkoutStatus.gift_card.code)}</p>
                  <p className="text-sm text-muted-foreground">
                    L&apos;email acheteur a été traité{checkoutStatus.gift_card.recipient_email ? " ainsi qu'un email destinataire." : "."}
                  </p>
                </div>
              )}

              {checkoutStatus?.status === "failed" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <p className="font-medium text-red-700">Le paiement a échoué ou la création de la carte n&apos;a pas pu être finalisée.</p>
                  <p className="text-sm text-red-600">Aucune carte cadeau n&apos;a été créée. Réessaie ou contacte le support.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>
      <Footer />

      <Dialog open={extrasOpen} onOpenChange={(open) => { if (!isSubmitting) setExtrasOpen(open) }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Un petit plus avec votre carte cadeau ?</DialogTitle>
            <DialogDescription>
              La carte cadeau est envoyée par email dans tous les cas. Vous pouvez y joindre un cadeau physique, livré à l&apos;adresse de votre choix.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setAddonId(null)}
              aria-pressed={addonId === null}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${addonId === null ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40"}`}
            >
              <Mail className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Carte cadeau par email uniquement</p>
                <p className="text-sm text-muted-foreground">Sans supplément</p>
              </div>
              {addonId === null && <Check className="h-5 w-5 text-primary" />}
            </button>

            {(addons || []).map((addon) => {
              const active = addonId === addon.id
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => setAddonId(addon.id)}
                  aria-pressed={active}
                  className={`flex gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40"}`}
                >
                  {addon.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={addon.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted"><Package className="h-7 w-7 text-muted-foreground" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-medium">{addon.name}</p>
                      <p className="font-semibold text-primary">{formatEuros(addon.price_cents)}</p>
                    </div>
                    {addon.description && <p className="mt-1 text-sm text-muted-foreground">{addon.description}</p>}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {addon.requires_shipping ? <><Truck className="h-3.5 w-3.5" />Livraison {addon.delivery_fee_cents > 0 ? formatEuros(addon.delivery_fee_cents) : "offerte"}</> : <><Store className="h-3.5 w-3.5" />À retirer au salon</>}
                    </p>
                  </div>
                  {active && <Check className="h-5 w-5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>

          {selectedAddon && (
            <div className="space-y-4 rounded-xl border border-primary/10 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <Label>Quantité</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Moins" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-8 text-center font-medium tabular-nums">{quantity}</span>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Plus" disabled={quantity >= MAX_ADDON_QUANTITY} onClick={() => setQuantity((value) => Math.min(MAX_ADDON_QUANTITY, value + 1))}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              {(selectedAddon.extra_fields || []).map((field) => (
                <div key={field.label} className="space-y-2">
                  <Label htmlFor={`extra-${field.label}`}>{field.label}{field.required ? " *" : ""}</Label>
                  <Input id={`extra-${field.label}`} value={extraAnswers[field.label] || ""} onChange={(e) => setExtraAnswers((current) => ({ ...current, [field.label]: e.target.value }))} />
                </div>
              ))}

              {selectedAddon.requires_shipping && (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium"><Truck className="h-4 w-4 text-primary" />Adresse de livraison</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="ship-name">Nom complet *</Label><Input id="ship-name" autoComplete="name" value={shipping.name} onChange={(e) => setShipping({ ...shipping, name: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="ship-phone">Téléphone *</Label><Input id="ship-phone" type="tel" autoComplete="tel" value={shipping.phone} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="ship-line1">Adresse *</Label><Input id="ship-line1" autoComplete="address-line1" value={shipping.line1} onChange={(e) => setShipping({ ...shipping, line1: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="ship-line2">Complément</Label><Input id="ship-line2" autoComplete="address-line2" value={shipping.line2} onChange={(e) => setShipping({ ...shipping, line2: e.target.value })} /></div>
                  <div className="grid gap-3 sm:grid-cols-[140px_1fr_1fr]">
                    <div className="space-y-1.5"><Label htmlFor="ship-postal">Code postal *</Label><Input id="ship-postal" autoComplete="postal-code" value={shipping.postal_code} onChange={(e) => setShipping({ ...shipping, postal_code: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="ship-city">Ville *</Label><Input id="ship-city" autoComplete="address-level2" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="ship-country">Pays</Label><Input id="ship-country" autoComplete="country-name" value={shipping.country} onChange={(e) => setShipping({ ...shipping, country: e.target.value })} /></div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1 rounded-xl bg-muted/40 p-4 text-sm">
            <div className="flex justify-between"><span>Carte cadeau — {selectedService?.name}</span><span>{formatEuros(priced.service_cents)}</span></div>
            {selectedAddon && <div className="flex justify-between"><span>{selectedAddon.name}{quantity > 1 ? ` × ${quantity}` : ""}</span><span>{formatEuros(priced.addon_cents)}</span></div>}
            {selectedAddon?.requires_shipping && <div className="flex justify-between"><span>Livraison</span><span>{priced.delivery_cents > 0 ? formatEuros(priced.delivery_cents) : "Offerte"}</span></div>}
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{formatEuros(priced.total_cents)}</span></div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setExtrasOpen(false)}>Retour</Button>
            <Button type="button" disabled={isSubmitting} onClick={() => void startPayment(Boolean(selectedAddon))}>
              {isSubmitting ? "Redirection vers Stripe..." : `Payer ${formatEuros(priced.total_cents)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function GiftPageFallback() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Card className="p-6 animate-pulse">
            <div className="h-8 w-64 bg-muted rounded mb-4" />
            <div className="h-4 w-full bg-muted rounded mb-2" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}

export default function GiftPage() {
  return (
    <Suspense fallback={<GiftPageFallback />}>
      <GiftPageContent />
    </Suspense>
  )
}
