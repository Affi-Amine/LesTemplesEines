import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SalonImageFrame } from "@/components/salon-image-frame"
import { getSalons } from "@/lib/api/server"
import { Mail, MapPin, Phone, Clock, ArrowRight } from "lucide-react"

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

function getTodaySummary(hours?: Record<string, { open: string; close: string }>) {
  if (!hours) return null

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
  const todayHours = hours[today]
  if (!todayHours) return null

  return `${dayLabels[today] || "Aujourd'hui"} · ${todayHours.open} - ${todayHours.close}`
}

export default async function ContactPage() {
  const salons = await getSalons()
  const primaryPhone = salons.find((salon) => salon.phone)?.phone
  const primaryEmail = salons.find((salon) => salon.email)?.email

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden px-4 pb-14 pt-28 md:pb-20 md:pt-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,171,89,0.14),transparent_28%),linear-gradient(180deg,rgba(21,18,15,0.22)_0%,rgba(21,18,15,0)_62%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-6">
              <Badge variant="secondary" className="border border-primary/20 bg-background/50 px-4 py-2 text-primary backdrop-blur-sm">
                Contact
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-serif font-bold leading-[1.02] sm:text-5xl md:text-6xl">
                  Prenez contact avec la maison qui vous correspond
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                  Retrouvez les coordonnées, horaires et accès de nos adresses. Les informations affichées ici proviennent directement des salons configurés dans l&apos;admin.
                </p>
              </div>
            </div>

            <Card className="temple-frame rounded-[1.75rem] border-primary/20 bg-[linear-gradient(145deg,rgba(34,27,22,0.96),rgba(20,16,13,0.98))] p-6 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-8">
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-primary/80">Contact principal</p>
                  <h2 className="mt-2 text-2xl font-semibold">Les Temples</h2>
                </div>

                <div className="space-y-4 text-sm sm:text-base">
                  {primaryPhone ? (
                    <a href={`tel:${primaryPhone}`} className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary">
                      <Phone className="h-4 w-4 text-primary" />
                      <span>{primaryPhone}</span>
                    </a>
                  ) : null}
                  {primaryEmail ? (
                    <a href={`mailto:${primaryEmail}`} className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>{primaryEmail}</span>
                    </a>
                  ) : null}
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{salons.length} adresse{salons.length > 1 ? "s" : ""} active{salons.length > 1 ? "s" : ""}</span>
                  </div>
                </div>

                <Button asChild size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/book">
                    Réserver un massage
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 md:pb-20">
        <div className="mx-auto max-w-7xl">
          {salons.length === 0 ? (
            <Card className="rounded-[1.75rem] border-primary/15 px-6 py-10 text-center">
              <h2 className="text-2xl font-serif font-semibold">Aucune adresse active pour le moment</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Dès qu&apos;un temple sera activé dans l&apos;admin, ses coordonnées apparaîtront ici automatiquement.
              </p>
            </Card>
          ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {salons.map((salon) => {
              const previewImage = salon.images?.[0] || salon.image_url || ""
              const todaySummary = getTodaySummary(salon.opening_hours)

              return (
                <Card key={salon.id} className="overflow-hidden rounded-[1.75rem] border-primary/15 bg-card/95">
                  <div className="grid h-full md:grid-cols-[0.9fr_1.1fr]">
                    <div className="relative min-h-[240px] bg-muted">
                      {previewImage ? (
                        <SalonImageFrame
                          src={previewImage}
                          alt={salon.name}
                          className="h-full w-full"
                          imageClassName="px-3 py-3"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(214,171,89,0.14),rgba(214,171,89,0.04))]">
                          <MapPin className="h-14 w-14 text-primary/35" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col p-6 sm:p-7">
                      <div className="mb-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Maison</p>
                        <h2 className="mt-2 text-2xl font-serif font-semibold">{salon.name}</h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{salon.address}, {salon.city}</p>
                      </div>

                      <div className="space-y-3 text-sm text-muted-foreground">
                        {salon.phone ? (
                          <a href={`tel:${salon.phone}`} className="flex items-center gap-3 transition-colors hover:text-primary">
                            <Phone className="h-4 w-4 text-primary" />
                            <span>{salon.phone}</span>
                          </a>
                        ) : null}
                        {salon.email ? (
                          <a href={`mailto:${salon.email}`} className="flex items-center gap-3 transition-colors hover:text-primary">
                            <Mail className="h-4 w-4 text-primary" />
                            <span>{salon.email}</span>
                          </a>
                        ) : null}
                        {todaySummary ? (
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-primary" />
                            <span>{todaySummary}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Button asChild variant="outline" className="flex-1 border-primary/20 bg-transparent hover:bg-primary/8">
                          <Link href={`/salons/${salon.slug}`}>Voir le temple</Link>
                        </Button>
                        <Button asChild className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                          <Link href={`/book/${salon.slug}`}>Réserver ici</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
