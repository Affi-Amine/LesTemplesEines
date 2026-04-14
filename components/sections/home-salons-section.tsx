"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MapPin, Clock } from "lucide-react"
import { Icon } from "@iconify/react"
import { useSalons } from "@/lib/hooks/use-salons"

export function HomeSalonsSection() {
  const { data: salons, isLoading, error } = useSalons()

  if (isLoading) {
    return (
      <section id="salons" className="py-20 bg-transparent">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16 text-center">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos Temples</span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">Trois Sanctuaires du Bien-être</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden border-primary/10 animate-pulse">
                <div className="h-56 bg-muted" />
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
    <section id="salons" className="py-20 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-destructive">Erreur lors du chargement des salons</p>
        </div>
      </section>
    )
  }

  return (
    <section id="salons" className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-16 text-center">
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos salons</span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">Trois lieux, une meme exigence</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Chaque établissement offre une atmosphère unique dédiée à votre détente et rajeunissement complets
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {salons?.map((salon, index) => {
            // Parse opening hours for display
            const openingHours = salon.opening_hours as Record<string, { open: string; close: string }>
            const mondayHours = openingHours?.monday || { open: "10:00", close: "20:00" }

            return (
              <Card
                key={salon.id}
                className={`overflow-hidden hover:shadow-xl transition-all duration-300 group border-primary/20 bg-card/92 backdrop-blur-sm cursor-pointer hover:-translate-y-1 home-reveal ${index === 0 ? "home-reveal-delay-1" : index === 1 ? "home-reveal-delay-2" : "home-reveal-delay-3"}`}
              >
                <div className="relative h-56 bg-muted overflow-hidden">
                  {/* Use images array if available, otherwise fall back to single image_url */}
                  {(salon.images && salon.images.length > 0) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={salon.images[0]}
                      alt={salon.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : salon.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={salon.image_url}
                      alt={salon.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-primary/5">
                      <Icon icon="solar:buildings-3-bold" className="w-16 h-16 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
                  {/* Show image count badge if multiple images */}
                  {(salon.images && salon.images.length > 1) && (
                    <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Icon icon="solar:gallery-bold" className="w-3 h-3" />
                      {salon.images.length}
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-2xl font-serif font-semibold leading-tight truncate">{salon.name}</h3>
                      <p className="text-sm text-primary/90 mt-1">{salon.city}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
                      Temple
                    </span>
                  </div>

                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex items-start gap-3 text-muted-foreground">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                      <span className="line-clamp-2">{salon.address}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Clock className="w-4 h-4 flex-shrink-0 text-primary" />
                      <span>Ouvert jusqu&apos;à {mondayHours.close}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link href={`/salons/${salon.slug}`} className="flex-1">
                      <Button variant="outline" className="w-full border-primary/20 hover:bg-primary/8 bg-transparent cursor-pointer">
                        En savoir plus
                      </Button>
                    </Link>
                    <Link href={`/book/${salon.slug}`} className="flex-1">
                      <Button className="w-full bg-primary hover:bg-primary/90 shadow-[0_10px_24px_rgba(214,171,89,0.16)] cursor-pointer">Réserver</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
