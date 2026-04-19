"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { FlowOutcomeHero } from "@/components/flow-outcome-hero"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { fetchAPI } from "@/lib/api/client"
import type { Pack, ClientPack } from "@/lib/types/database"
import { toast } from "sonner"

type CheckoutStatus = {
  status: "open" | "completed" | "failed"
  pack?: Pack | null
  client_pack?: ClientPack | null
}

type OutcomeStatus = "success" | "pending" | "error"

function ForfaitsContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const checkoutState = searchParams.get("checkout")
  const [selectedPackId, setSelectedPackId] = useState("")
  const [installmentCount, setInstallmentCount] = useState("1")
  const [form, setForm] = useState({
    customer_first_name: "",
    customer_last_name: "",
    customer_phone: "",
    customer_email: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: packs, isLoading } = useQuery({
    queryKey: ["public-packs"],
    queryFn: () => fetchAPI<Pack[]>("/packs?active=true"),
  })

  const { data: checkoutStatus } = useQuery({
    queryKey: ["pack-checkout-status", sessionId],
    queryFn: () => fetchAPI<CheckoutStatus>(`/stripe/checkout-status?session_id=${sessionId}`),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => query.state.data?.status === "open" ? 3000 : false,
  })

  const selectedPack = useMemo(
    () => packs?.find((pack) => pack.id === selectedPackId),
    [packs, selectedPackId]
  )
  const checkoutHero: {
    status: OutcomeStatus | null
    title: string
    description: string
    helper?: string
  } | null = sessionId
    ? {
        status: checkoutStatus?.status === "failed" ? "error" : checkoutStatus?.status === "open" ? "pending" : checkoutStatus?.status === "completed" ? "success" : null,
        title:
          checkoutStatus?.status === "completed"
            ? "Forfait activé"
            : checkoutStatus?.status === "failed"
              ? "Paiement non finalisé"
              : checkoutStatus?.status === "open"
                ? "Activation en cours"
                : "",
        description:
          checkoutStatus?.status === "completed"
            ? "Votre paiement est confirmé et votre forfait client est maintenant disponible. Un email vient d’être envoyé pour créer votre mot de passe et accéder à votre espace client."
            : checkoutStatus?.status === "failed"
              ? "Le paiement ou l’activation du forfait n’a pas abouti. Vous pouvez relancer l’achat."
              : checkoutStatus?.status === "open"
                ? "Votre paiement est bien reçu. Nous finalisons encore l’activation du forfait."
                : "",
        helper:
          checkoutStatus?.status === "completed" && checkoutStatus.client_pack
            ? `${checkoutStatus.client_pack.remaining_sessions} séance(s) disponible(s) sur ${checkoutStatus.client_pack.total_sessions}. Vérifiez votre boîte mail, créez votre mot de passe puis connectez-vous pour retrouver votre forfait et réserver vos séances.`
            : checkoutStatus?.status === "open"
              ? "La page se met à jour automatiquement."
              : undefined,
      }
    : null

  useEffect(() => {
    if (checkoutState === "cancel") {
      toast.error("Le paiement a été annulé.")
    }
  }, [checkoutState])

  useEffect(() => {
    if (selectedPack && !selectedPack.allowed_installments.includes(Number(installmentCount))) {
      setInstallmentCount(String(selectedPack.allowed_installments[0] || 1))
    }
  }, [installmentCount, selectedPack])

  const handlePurchase = async () => {
    if (!selectedPack) {
      toast.error("Choisissez un forfait avant de continuer.")
      return
    }

    if (!form.customer_first_name.trim() || form.customer_first_name.trim().length < 2) {
      toast.error("Le prénom doit contenir au moins 2 caractères.")
      return
    }

    if (!form.customer_last_name.trim() || form.customer_last_name.trim().length < 2) {
      toast.error("Le nom doit contenir au moins 2 caractères.")
      return
    }

    if (!form.customer_phone.trim() || form.customer_phone.trim().length < 9) {
      toast.error("Renseignez un numéro de téléphone valide.")
      return
    }

    if (!form.customer_email.trim()) {
      toast.error("Renseignez votre email pour recevoir l’accès au compte.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchAPI<{ url: string }>("/packs/purchase", {
        method: "POST",
        body: JSON.stringify({
          pack_id: selectedPack.id,
          installment_count: Number(installmentCount),
          customer_first_name: form.customer_first_name,
          customer_last_name: form.customer_last_name,
          customer_phone: form.customer_phone,
          customer_email: form.customer_email,
        }),
      })

      window.location.href = response.url
    } catch (error: any) {
      toast.error(error.message || "Impossible de lancer le paiement.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          {checkoutHero?.status ? (
            <FlowOutcomeHero
              status={checkoutHero.status}
              eyebrow="Forfait"
              title={checkoutHero.title}
              description={checkoutHero.description}
              helper={checkoutHero.helper}
            />
          ) : null}

          <div className="text-center space-y-4">
            <span className="inline-flex items-center rounded-full border px-4 py-2 text-sm text-muted-foreground">
              Forfaits
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-bold">Acheter un pack de séances</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Achetez votre forfait, créez votre accès client et utilisez vos séances directement lors de vos prochaines réservations.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1.3fr_0.9fr] gap-8 items-start">
            <div className="space-y-4">
              {isLoading ? (
                [1, 2, 3].map((item) => (
                  <Card key={item} className="p-6 animate-pulse">
                    <div className="h-6 bg-muted rounded w-1/3 mb-3" />
                    <div className="h-4 bg-muted rounded w-full mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </Card>
                ))
              ) : (
                packs?.map((pack) => {
                  const selected = selectedPackId === pack.id
                  return (
                    <Card
                      key={pack.id}
                      className={`p-6 cursor-pointer transition-all ${selected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40"}`}
                      onClick={() => setSelectedPackId(pack.id)}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="break-words text-xl font-semibold">{pack.name}</h2>
                          {pack.description && (
                            <p className="text-sm text-muted-foreground mt-2">{pack.description}</p>
                          )}
                          <p className="text-sm text-muted-foreground mt-3">
                            {pack.number_of_sessions} séance(s)
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-2xl font-bold text-primary">{Number(pack.price).toFixed(2)}€</p>
                          <p className="text-xs text-muted-foreground">
                            {pack.allowed_installments.join("x, ")}x possible
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>

            <Card className="space-y-5 p-6 lg:sticky lg:top-24">
              <h2 className="text-2xl font-semibold">Finaliser l&apos;achat</h2>

              {selectedPack ? (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="break-words font-semibold">{selectedPack.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedPack.number_of_sessions} séance(s)</p>
                  <p className="text-lg font-bold text-primary mt-2">{Number(selectedPack.price).toFixed(2)}€</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Sélectionnez un forfait dans la liste.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer_first_name">Prénom</Label>
                  <Input
                    id="customer_first_name"
                    value={form.customer_first_name}
                    onChange={(e) => setForm((current) => ({ ...current, customer_first_name: e.target.value }))}
                    placeholder="Jean"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_last_name">Nom</Label>
                  <Input
                    id="customer_last_name"
                    value={form.customer_last_name}
                    onChange={(e) => setForm((current) => ({ ...current, customer_last_name: e.target.value }))}
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_phone">Téléphone</Label>
                <Input
                  id="customer_phone"
                  type="tel"
                  value={form.customer_phone}
                  onChange={(e) => setForm((current) => ({ ...current, customer_phone: e.target.value }))}
                  placeholder="+33 6 12 34 56 78"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_email">Email</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm((current) => ({ ...current, customer_email: e.target.value }))}
                  placeholder="client@email.com"
                />
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Ces informations servent à créer votre compte client automatiquement et à préremplir vos futures réservations avec votre forfait.
              </p>

              <div className="space-y-3">
                <Label>Paiement</Label>
                <RadioGroup value={installmentCount} onValueChange={setInstallmentCount}>
                  {(selectedPack?.allowed_installments || [1]).map((value) => (
                    <div key={value} className="flex items-center gap-3 rounded-lg border p-3">
                      <RadioGroupItem value={String(value)} id={`installment-${value}`} />
                      <Label htmlFor={`installment-${value}`} className="cursor-pointer">
                        {value} fois
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button onClick={handlePurchase} disabled={!selectedPack || isSubmitting} className="w-full">
                {isSubmitting ? "Redirection vers Stripe..." : "Acheter"}
              </Button>

              {checkoutStatus?.status === "completed" && checkoutStatus.client_pack && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
                  Votre forfait est actif. Il reste {checkoutStatus.client_pack.remaining_sessions} séance(s) sur {checkoutStatus.client_pack.total_sessions}.
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

export default function ForfaitsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <ForfaitsContent />
    </Suspense>
  )
}
