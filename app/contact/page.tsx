import Link from "next/link"
import type { ReactNode } from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getSalons, type Salon } from "@/lib/api/server"
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react"

export const dynamic = "force-dynamic"

const dayLabels: Record<string, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
}

function getPreviewImage(salon: Salon) {
  return salon.images?.[0] || salon.image_url || ""
}

function getTodaySummary(hours?: Record<string, { open: string; close: string }>) {
  if (!hours) return null

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "Europe/Paris" }).toLowerCase()
  const todayHours = hours[today]
  if (!todayHours) return null

  return `${dayLabels[today] || "Aujourd'hui"} ${todayHours.open} - ${todayHours.close}`
}

function ContactLine({
  icon,
  children,
  href,
}: {
  icon: ReactNode
  children: ReactNode
  href?: string
}) {
  const content = (
    <>
      <span className="mt-0.5 text-primary">{icon}</span>
      <span className="min-w-0 leading-6">{children}</span>
    </>
  )

  if (href) {
    return (
      <a href={href} className="grid grid-cols-[1rem_1fr] gap-3 text-sm text-muted-foreground transition-colors hover:text-primary">
        {content}
      </a>
    )
  }

  return (
    <div className="grid grid-cols-[1rem_1fr] gap-3 text-sm text-muted-foreground">
      {content}
    </div>
  )
}

function SalonContactCard({ salon }: { salon: Salon }) {
  const previewImage = getPreviewImage(salon)
  const todaySummary = getTodaySummary(salon.opening_hours)

  return (
    <Card className="group flex h-full min-h-[430px] overflow-hidden rounded-2xl border-primary/15 bg-card/95 shadow-[0_18px_56px_rgba(0,0,0,0.1)]">
      <article className="grid h-full w-full md:grid-cols-[0.82fr_1.18fr]">
        <div className="relative min-h-[220px] overflow-hidden bg-muted md:min-h-full">
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
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Maison</p>
            <h2 className="mt-2 text-2xl font-serif font-semibold leading-tight">{salon.name}</h2>
          </div>

          <div className="mt-5 space-y-3">
            <ContactLine icon={<MapPin className="h-4 w-4" />}>
              {salon.address}, {salon.city}
            </ContactLine>
            {salon.phone ? (
              <ContactLine icon={<Phone className="h-4 w-4" />} href={`tel:${salon.phone}`}>
                {salon.phone}
              </ContactLine>
            ) : null}
            {salon.email ? (
              <ContactLine icon={<Mail className="h-4 w-4" />} href={`mailto:${salon.email}`}>
                {salon.email}
              </ContactLine>
            ) : null}
            {todaySummary ? (
              <ContactLine icon={<Clock className="h-4 w-4" />}>
                {todaySummary}
              </ContactLine>
            ) : null}
          </div>

          <div className="mt-auto grid gap-3 pt-6 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-11 border-primary/25 bg-transparent hover:bg-primary/8">
              <Link href={`/salons/${salon.slug}`}>Voir le temple</Link>
            </Button>
            <Button asChild className="h-11 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href={`/book/${salon.slug}`}>Reserver ici</Link>
            </Button>
          </div>
        </div>
      </article>
    </Card>
  )
}

export default async function ContactPage() {
  const salons = await getSalons()
  const primaryPhone = salons.find((salon) => salon.phone)?.phone
  const primaryEmail = salons.find((salon) => salon.email)?.email

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden px-4 pb-14 pt-28 md:pb-16 md:pt-32">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(214,171,89,0.1)_0%,rgba(214,171,89,0)_42%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
            <div className="space-y-5">
              <Badge variant="secondary" className="border border-primary/20 bg-background/55 px-4 py-2 text-primary backdrop-blur-sm">
                Contact
              </Badge>
              <h1 className="max-w-4xl text-4xl font-serif font-bold leading-[1.04] sm:text-5xl md:text-6xl">
                Toutes nos coordonnees en un seul endroit
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                Appelez, ecrivez, comparez les adresses ou reservez directement dans le temple qui vous convient.
              </p>
            </div>

            <Card className="rounded-2xl border-primary/20 bg-card/95 p-5 shadow-[0_18px_56px_rgba(0,0,0,0.12)] sm:p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Contact principal</p>
              <h2 className="mt-2 text-2xl font-semibold">Les Temples</h2>
              <div className="mt-5 space-y-3">
                {primaryPhone ? (
                  <ContactLine icon={<Phone className="h-4 w-4" />} href={`tel:${primaryPhone}`}>
                    {primaryPhone}
                  </ContactLine>
                ) : null}
                {primaryEmail ? (
                  <ContactLine icon={<Mail className="h-4 w-4" />} href={`mailto:${primaryEmail}`}>
                    {primaryEmail}
                  </ContactLine>
                ) : null}
                <ContactLine icon={<MapPin className="h-4 w-4" />}>
                  {salons.length} adresse{salons.length > 1 ? "s" : ""} active{salons.length > 1 ? "s" : ""}
                </ContactLine>
              </div>
              <Button asChild size="lg" className="mt-6 h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/book">
                  Reserver un massage
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 md:pb-20">
        <div className="mx-auto max-w-7xl">
          {salons.length === 0 ? (
            <Card className="rounded-2xl border-primary/15 px-6 py-10 text-center">
              <h2 className="text-2xl font-serif font-semibold">Aucune adresse active pour le moment</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Des qu&apos;un temple sera active dans l&apos;admin, ses coordonnees apparaitront ici automatiquement.
              </p>
            </Card>
          ) : (
            <div className="grid items-stretch gap-6 xl:grid-cols-2">
              {salons.map((salon) => (
                <SalonContactCard key={salon.id} salon={salon} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
