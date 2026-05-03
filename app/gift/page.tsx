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
import { ServiceCatalog } from "@/components/service-catalog"
import { useServices } from "@/lib/hooks/use-services"
import { fetchAPI } from "@/lib/api/client"
import { formatGiftCardCode } from "@/lib/gift-cards"
import { Mail, Gift } from "lucide-react"
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

  const selectedService = useMemo(
    () => services?.find((service) => service.id === selectedServiceId),
    [services, selectedServiceId]
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

  const handlePurchase = async () => {
    if (!selectedService || !form.buyer_email) {
      toast.error("Veuillez choisir une prestation et renseigner le nom et l'email de l'offrant.")
      return
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
        }),
      })

      window.location.href = response.url
    } catch (error: any) {
      toast.error(error.message || "Impossible de générer la carte cadeau.")
    } finally {
      setIsSubmitting(false)
    }
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
            </p>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_0.9fr] lg:gap-8">
            <div className="space-y-3 sm:space-y-6">
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
                  services={services || []}
                  selectedServiceId={selectedServiceId}
                  onSelectService={setSelectedServiceId}
                  compact
                />
              )}
            </div>

            <Card className="gap-3.5 space-y-0 rounded-xl border-primary/10 bg-card/60 px-3.5 py-4 shadow-none sm:gap-4 sm:space-y-5 sm:p-6 lg:sticky lg:top-24">
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

              <Button onClick={handlePurchase} disabled={!selectedService || !form.buyer_name || !form.buyer_email || isSubmitting} className="w-full">
                {isSubmitting ? "Redirection vers Stripe..." : "Payer"}
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
