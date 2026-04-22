import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SalonImageFrame } from "@/components/salon-image-frame"
import { getSalons } from "@/lib/api/server"
import { ArrowRight, Clock, MapPin, Phone } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function NosTemplesPage() {
  const salons = await getSalons()

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden px-4 pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,171,89,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(214,171,89,0.08),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-10 space-y-5 md:mb-14">
            <Badge variant="secondary" className="border border-primary/20 bg-background/55 px-4 py-2 text-primary backdrop-blur-sm">
              Nos temples
            </Badge>
            <h1 className="max-w-5xl text-4xl font-serif font-bold leading-[1.02] sm:text-5xl md:text-6xl">
              Des maisons de bien-être pensées comme des refuges en ville
            </h1>
            <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
              Chaque adresse garde le même niveau d&apos;exigence, avec sa propre respiration, son propre rythme et ses propres accès. Choisissez le temple le plus proche ou celui dont l&apos;atmosphère vous attire le plus.
            </p>
          </div>

          {salons.length === 0 ? (
            <Card className="rounded-[1.75rem] border-primary/15 px-6 py-10 text-center">
              <h2 className="text-2xl font-serif font-semibold">Aucun temple actif pour le moment</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Cette page se remplira automatiquement dès qu&apos;une adresse sera active dans l&apos;admin.
              </p>
            </Card>
          ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {salons.map((salon, index) => {
              const previewImage = salon.images?.[0] || salon.image_url || ""
              const mondayHours = salon.opening_hours?.monday

              return (
                <Card
                  key={salon.id}
                  className={`group overflow-hidden rounded-[1.75rem] border-primary/15 bg-card/95 shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(214,171,89,0.12)] ${index === 0 ? "lg:col-span-2" : ""}`}
                >
                  <div className={`${index === 0 ? "grid lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
                    <div className={`relative bg-muted ${index === 0 ? "min-h-[320px]" : "h-64"}`}>
                      {previewImage ? (
                        <SalonImageFrame
                          src={previewImage}
                          alt={salon.name}
                          className="h-full w-full"
                          imageClassName="px-4 py-4 transition-transform duration-500 group-hover:scale-[1.03]"
                          backgroundClassName="transition-transform duration-500 group-hover:scale-[1.14]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(214,171,89,0.14),rgba(214,171,89,0.04))]">
                          <MapPin className="h-16 w-16 text-primary/35" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col p-6 sm:p-7">
                      <div className="mb-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary/75">{salon.city}</p>
                        <h2 className="mt-2 text-2xl font-serif font-semibold sm:text-3xl">{salon.name}</h2>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                          Une adresse pensée pour ralentir, relâcher les tensions et retrouver un vrai calme de corps.
                        </p>
                      </div>

                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-start gap-3">
                          <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                          <span>{salon.address}, {salon.city}</span>
                        </div>
                        {salon.phone ? (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-primary" />
                            <span>{salon.phone}</span>
                          </div>
                        ) : null}
                        {mondayHours ? (
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-primary" />
                            <span>Lundi · {mondayHours.open} - {mondayHours.close}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Button asChild variant="outline" className="flex-1 border-primary/20 bg-transparent hover:bg-primary/8">
                          <Link href={`/salons/${salon.slug}`}>Découvrir</Link>
                        </Button>
                        <Button asChild className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                          <Link href={`/book/${salon.slug}`}>
                            Réserver
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
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
