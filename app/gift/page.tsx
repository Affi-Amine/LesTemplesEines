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
import { useServices } from "@/lib/hooks/use-services"
import { fetchAPI } from "@/lib/api/client"
import { formatGiftCardCode } from "@/lib/gift-cards"
import { Mail, Gift, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

type EmailStatus = {
  email_enabled: boolean
  email_from: string
  app_url: string
  stripe_enabled: boolean
}

type CheckoutStatus = {
  session_id: string
  checkout_type: "gift_card" | "appointment"
  status: "open" | "completed" | "failed"
  gift_card?: {
    code: string
    recipient_email: string | null
  } | null
}

function GiftPageContent() {
  const searchParams = useSearchParams()
  const { data: services, isLoading } = useServices(undefined, true)
  const { data: emailStatus } = useQuery({
    queryKey: ["email-status"],
    queryFn: () => fetchAPI<EmailStatus>("/email/status"),
  })
  const sessionId = searchParams.get("session_id")
  const checkoutState = searchParams.get("checkout")

  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
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
      toast.error("Le paiement a ete annule.")
    }
  }, [checkoutState])

  const handlePurchase = async () => {
    if (!selectedService || !form.buyer_email) {
      toast.error("Veuillez choisir une prestation et renseigner l'email acheteur.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchAPI<{ url: string }>("/gift-cards/purchase", {
        method: "POST",
        body: JSON.stringify({
          service_id: selectedService.id,
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
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground">
              <Gift className="w-4 h-4" />
              Cartes cadeaux
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-bold">Offrir une expérience Les Temples</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choisissez une prestation, renseignez les informations de l&apos;acheteur et du destinataire, puis nous générons une carte cadeau avec envoi par email.
            </p>
          </div>

          <Card className={`p-4 border ${emailStatus?.email_enabled ? "border-green-200 bg-green-50/70" : "border-amber-200 bg-amber-50/70"}`}>
            <div className="flex items-start gap-3">
              {emailStatus?.email_enabled ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />}
              <div className="text-sm">
                <p className="font-medium">
                  {emailStatus?.email_enabled ? "Envoi d'email configuré" : "Envoi d'email non configuré"}
                </p>
                <p className="text-muted-foreground">
                  {emailStatus?.email_enabled
                    ? `Les emails partiront depuis ${emailStatus.email_from}.`
                    : "Renseigne RESEND_API_KEY, EMAIL_FROM et APP_URL dans .env.local pour activer les envois réels."}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-[1.3fr_0.9fr] gap-8 items-start">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">1. Choisir une prestation</h2>
              {isLoading ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((item) => (
                    <Card key={item} className="p-6 animate-pulse">
                      <div className="h-6 w-2/3 bg-muted rounded mb-3" />
                      <div className="h-4 w-full bg-muted rounded mb-2" />
                      <div className="h-4 w-1/2 bg-muted rounded" />
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {services?.map((service) => {
                    const isSelected = service.id === selectedServiceId
                    return (
                      <Card
                        key={service.id}
                        className={`p-6 cursor-pointer transition-all ${isSelected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40"}`}
                        onClick={() => setSelectedServiceId(service.id)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold">{service.name}</h3>
                            {service.description && (
                              <p className="text-sm text-muted-foreground mt-2">{service.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary">{(service.price_cents / 100).toFixed(2)}€</p>
                            <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            <Card className="p-6 space-y-5 sticky top-24">
              <h2 className="text-2xl font-semibold">2. Informations d&apos;envoi</h2>

              {selectedService ? (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Prestation sélectionnée</p>
                  <p className="font-semibold">{selectedService.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedService.duration_minutes} min</p>
                  <p className="text-lg font-bold text-primary mt-2">{(selectedService.price_cents / 100).toFixed(2)}€</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Sélectionne d&apos;abord une prestation dans la liste.
                </div>
              )}

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

              <Button onClick={handlePurchase} disabled={!selectedService || !form.buyer_email || isSubmitting} className="w-full">
                {isSubmitting ? "Redirection vers Stripe..." : "Payer"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Le paiement en ligne est obligatoire. La carte cadeau sera creee uniquement apres confirmation Stripe.
              </p>

              {checkoutStatus?.status === "open" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <p className="font-medium text-amber-800">Paiement confirme, finalisation en cours</p>
                  <p className="text-sm text-amber-700">Nous attendons la confirmation finale de Stripe avant de generer la carte cadeau.</p>
                </div>
              )}

              {checkoutStatus?.status === "completed" && checkoutStatus.gift_card && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <Mail className="w-4 h-4" />
                    Carte cadeau generee
                  </div>
                  <p className="text-sm">Code cadeau</p>
                  <p className="font-mono text-lg">{formatGiftCardCode(checkoutStatus.gift_card.code)}</p>
                  <p className="text-sm text-muted-foreground">
                    L&apos;email acheteur a ete traite{checkoutStatus.gift_card.recipient_email ? " ainsi qu'un email destinataire." : "."}
                  </p>
                </div>
              )}

              {checkoutStatus?.status === "failed" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <p className="font-medium text-red-700">Le paiement a echoue ou la creation de la carte n'a pas pu etre finalisee.</p>
                  <p className="text-sm text-red-600">Aucune carte cadeau n'a ete creee. Reessaie ou contacte le support.</p>
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
