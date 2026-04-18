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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { fetchAPI } from "@/lib/api/client"
import type { Pack, ClientPack } from "@/lib/types/database"
import { toast } from "sonner"

type CheckoutStatus = {
  status: "open" | "completed" | "failed"
  pack?: Pack | null
  client_pack?: ClientPack | null
}

function ForfaitsContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const checkoutState = searchParams.get("checkout")
  const [selectedPackId, setSelectedPackId] = useState("")
  const [installmentCount, setInstallmentCount] = useState("1")
  const [form, setForm] = useState({
    customer_name: "",
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
    if (!selectedPack || !form.customer_email || !form.customer_name) {
      toast.error("Renseignez votre nom, votre email et choisissez un forfait.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchAPI<{ url: string }>("/packs/purchase", {
        method: "POST",
        body: JSON.stringify({
          pack_id: selectedPack.id,
          installment_count: Number(installmentCount),
          customer_email: form.customer_email,
          customer_name: form.customer_name,
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
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-semibold">{pack.name}</h2>
                          {pack.description && (
                            <p className="text-sm text-muted-foreground mt-2">{pack.description}</p>
                          )}
                          <p className="text-sm text-muted-foreground mt-3">
                            {pack.number_of_sessions} séance(s)
                          </p>
                        </div>
                        <div className="text-right">
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

            <Card className="p-6 space-y-5 sticky top-24">
              <h2 className="text-2xl font-semibold">Finaliser l'achat</h2>

              {selectedPack ? (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="font-semibold">{selectedPack.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedPack.number_of_sessions} séance(s)</p>
                  <p className="text-lg font-bold text-primary mt-2">{Number(selectedPack.price).toFixed(2)}€</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Sélectionnez un forfait dans la liste.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="customer_name">Nom</Label>
                <Input
                  id="customer_name"
                  value={form.customer_name}
                  onChange={(e) => setForm((current) => ({ ...current, customer_name: e.target.value }))}
                  placeholder="Prénom Nom"
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
