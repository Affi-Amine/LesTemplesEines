import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getSalons, type Salon } from "@/lib/api/server"
import { ArrowRight, Clock, MapPin, Phone } from "lucide-react"

export const dynamic = "force-dynamic"

const FALLBACK_COPY = "Un refuge urbain pour ralentir, relacher les tensions et retrouver un vrai calme de corps."

function getPreviewImage(salon: Salon) {
  return salon.images?.[0] || salon.image_url || ""
}

function getOpeningLine(salon: Salon) {
  const mondayHours = salon.opening_hours?.monday
  if (!mondayHours) return null

  return `Lundi ${mondayHours.open} - ${mondayHours.close}`
}

function TempleCard({ salon }: { salon: Salon }) {
  const previewImage = getPreviewImage(salon)
  const openingLine = getOpeningLine(salon)

  return (
    <Card className="group flex h-full min-h-[520px] overflow-hidden rounded-2xl border-primary/15 bg-card/95 shadow-[0_18px_56px_rgba(0,0,0,0.12)] transition-transform duration-300 hover:-translate-y-1">
      <article className="flex h-full w-full flex-col">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {previewImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage}
              alt={salon.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(214,171,89,0.16),rgba(34,27,22,0.92))]">
              <MapPin className="h-12 w-12 text-primary/45" />
            </div>
          )}
          <div className="absolute left-4 top-4 rounded-full border border-primary/25 bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-primary backdrop-blur">
            {salon.city}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <div>
            <h2 className="text-2xl font-serif font-semibold leading-tight text-foreground">{salon.name}</h2>
            <p className="mt-3 min-h-[3rem] text-sm leading-6 text-muted-foreground">
              {salon.description || FALLBACK_COPY}
            </p>
          </div>

          <div className="mt-5 space-y-3 text-sm text-muted-foreground">
            <div className="grid grid-cols-[1rem_1fr] gap-3">
              <MapPin className="mt-1 h-4 w-4 text-primary" />
              <span className="leading-6">{salon.address}, {salon.city}</span>
            </div>
            {salon.phone ? (
              <a href={`tel:${salon.phone}`} className="grid grid-cols-[1rem_1fr] gap-3 transition-colors hover:text-primary">
                <Phone className="mt-0.5 h-4 w-4 text-primary" />
                <span>{salon.phone}</span>
              </a>
            ) : null}
            {openingLine ? (
              <div className="grid grid-cols-[1rem_1fr] gap-3">
                <Clock className="mt-0.5 h-4 w-4 text-primary" />
                <span>{openingLine}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-auto grid gap-3 pt-6 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-11 border-primary/25 bg-transparent hover:bg-primary/8">
              <Link href={`/salons/${salon.slug}`}>Decouvrir</Link>
            </Button>
            <Button asChild className="h-11 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href={`/book/${salon.slug}`}>
                Reserver
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </article>
    </Card>
  )
}

export default async function NosTemplesPage() {
  const salons = await getSalons()

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden px-4 pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(214,171,89,0.09)_0%,rgba(214,171,89,0)_38%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-10 max-w-5xl space-y-5 md:mb-12">
            <Badge variant="secondary" className="border border-primary/20 bg-background/55 px-4 py-2 text-primary backdrop-blur-sm">
              Nos temples
            </Badge>
            <h1 className="max-w-4xl text-4xl font-serif font-bold leading-[1.04] sm:text-5xl md:text-6xl">
              Choisissez votre maison de bien-etre
            </h1>
            <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
              Des adresses sobres, chaleureuses et faciles a comparer. Chaque carte reprend les informations utiles pour choisir rapidement un temple et reserver sans friction.
            </p>
          </div>

          {salons.length === 0 ? (
            <Card className="rounded-2xl border-primary/15 px-6 py-10 text-center">
              <h2 className="text-2xl font-serif font-semibold">Aucun temple actif pour le moment</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Cette page se remplira automatiquement des qu&apos;une adresse sera active dans l&apos;admin.
              </p>
            </Card>
          ) : (
            <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
              {salons.map((salon) => (
                <TempleCard key={salon.id} salon={salon} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
