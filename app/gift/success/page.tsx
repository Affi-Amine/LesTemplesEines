"use client"

import { Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchAPI } from "@/lib/api/client"
import { formatGiftCardCode } from "@/lib/gift-cards"
import { ArrowLeft, CheckCircle2, Clock3, Gift, Mail, ReceiptText, Sparkles, TriangleAlert } from "lucide-react"

type GiftCheckoutStatus = {
  session_id: string
  checkout_type: "gift_card" | "appointment"
  status: "open" | "completed" | "failed"
  amount_cents: number
  currency: string
  payload: {
    buyer_email: string | null
    recipient_email: string | null
    recipient_name: string | null
    personal_message: string | null
    service_id: string | null
  } | null
  service: {
    id: string
    name: string
    duration_minutes: number
    price_cents: number
  } | null
  gift_card?: {
    code: string
    recipient_email: string | null
  } | null
}

function formatPrice(amountCents: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
  }).format(amountCents / 100)
}

function GiftSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["gift-success", sessionId],
    queryFn: () => fetchAPI<GiftCheckoutStatus>(`/stripe/checkout-status?session_id=${sessionId}`),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => query.state.data?.status === "open" ? 3000 : false,
  })

  const service = data?.service
  const summaryPrice = data ? formatPrice(data.amount_cents, data.currency) : null

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="px-4 pb-16 pt-28">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              {data?.status === "completed" ? (
                <CheckCircle2 className="h-9 w-9 text-primary" />
              ) : data?.status === "failed" || isError ? (
                <TriangleAlert className="h-9 w-9 text-destructive" />
              ) : (
                <Clock3 className="h-9 w-9 text-primary" />
              )}
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Achat confirme</p>
            <h1 className="mt-3 text-4xl font-serif font-bold md:text-5xl">
              {data?.status === "completed"
                ? "Merci pour votre achat"
                : data?.status === "failed" || isError
                  ? "Le paiement n'a pas pu etre finalise"
                  : "Votre carte cadeau est en cours de creation"}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              {data?.status === "completed"
                ? "Votre paiement a bien ete recu. Voici le recapitulatif de votre commande et les informations de la carte cadeau."
                : data?.status === "failed" || isError
                  ? "Nous n'avons pas reussi a recuperer correctement votre achat. Vous pouvez revenir a la page cadeau ou contacter le salon."
                  : "Le paiement est valide. Nous attendons la confirmation finale de Stripe avant de generer et envoyer la carte cadeau."}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="gap-0 overflow-hidden rounded-[1.75rem] py-0 temple-frame">
              <div className="border-b border-primary/10 px-6 py-5">
                <div className="flex items-center gap-3">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Recapitulatif</h2>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="flex items-start justify-between gap-4 border-b border-primary/10 pb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Achat</p>
                    <p className="font-semibold">Carte cadeau Les Temples</p>
                  </div>
                  {summaryPrice && <p className="text-lg font-semibold text-primary">{summaryPrice}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                    <p className="text-sm text-muted-foreground">Prestation</p>
                    <p className="mt-1 font-semibold">{service?.name || "En cours de recuperation"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {service?.duration_minutes ? `${service.duration_minutes} min` : "Duree a confirmer"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                    <p className="text-sm text-muted-foreground">Acheteur</p>
                    <p className="mt-1 font-medium">{data?.payload?.buyer_email || "Non renseigne"}</p>
                  </div>

                  <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                    <p className="text-sm text-muted-foreground">Destinataire</p>
                    <p className="mt-1 font-medium">{data?.payload?.recipient_name || "Non renseigne"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{data?.payload?.recipient_email || "Pas d'email destinataire"}</p>
                  </div>
                </div>

                {data?.payload?.personal_message && (
                  <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                    <p className="text-sm text-muted-foreground">Message personnalise</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{data.payload.personal_message}</p>
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="gap-0 overflow-hidden rounded-[1.75rem] py-0 temple-frame">
                <div className="border-b border-primary/10 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <Gift className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Statut de la carte cadeau</h2>
                  </div>
                </div>

                <div className="space-y-4 px-6 py-6">
                  {isLoading && (
                    <div className="rounded-2xl border border-primary/10 bg-background/35 p-4 text-sm text-muted-foreground">
                      Chargement du recapitulatif...
                    </div>
                  )}

                  {data?.status === "open" && (
                    <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
                      <div className="flex items-center gap-2 font-medium text-amber-200">
                        <Clock3 className="h-4 w-4" />
                        Finalisation en cours
                      </div>
                      <p className="mt-2 text-sm text-amber-100/80">
                        La page se met a jour automatiquement jusqu'a la creation definitive de la carte cadeau.
                      </p>
                    </div>
                  )}

                  {data?.status === "completed" && (
                    <>
                      <div className="rounded-2xl border border-green-300/30 bg-green-500/10 p-4">
                        <div className="flex items-center gap-2 font-medium text-green-200">
                          <CheckCircle2 className="h-4 w-4" />
                          Carte cadeau generee
                        </div>
                        <p className="mt-2 text-sm text-green-100/80">
                          Votre carte cadeau est prete et l'email a ete traite.
                        </p>
                      </div>

                      {data.gift_card?.code && (
                        <div className="rounded-2xl border border-primary/15 bg-background/35 p-4">
                          <p className="text-sm text-muted-foreground">Code cadeau</p>
                          <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.16em] text-primary">
                            {formatGiftCardCode(data.gift_card.code)}
                          </p>
                        </div>
                      )}

                      <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Mail className="h-4 w-4 text-primary" />
                          Envoi email
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Un email a ete traite pour {data.payload?.buyer_email || "l'acheteur"}
                          {data.gift_card?.recipient_email ? ` et pour ${data.gift_card.recipient_email}` : "."}
                        </p>
                      </div>
                    </>
                  )}

                  {(data?.status === "failed" || isError) && (
                    <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
                      <div className="flex items-center gap-2 font-medium text-destructive">
                        <TriangleAlert className="h-4 w-4" />
                        Creation echouee
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Le paiement ou la generation de la carte cadeau n'a pas pu etre finalise.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="gap-0 overflow-hidden rounded-[1.75rem] py-0 temple-frame">
                <div className="px-6 py-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">Et maintenant ?</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Gardez cette page ou l'email de confirmation jusqu'a la bonne reception de la carte cadeau.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="outline" size="lg">
              <Link href="/gift">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux cartes cadeaux
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/">Retour a l'accueil</Link>
            </Button>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}

function GiftSuccessFallback() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="px-4 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <Card className="p-6">
            <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}

export default function GiftSuccessPage() {
  return (
    <Suspense fallback={<GiftSuccessFallback />}>
      <GiftSuccessContent />
    </Suspense>
  )
}
