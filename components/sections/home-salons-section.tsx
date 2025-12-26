"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Clock } from "lucide-react"
import { useSalons } from "@/lib/hooks/use-salons"

export function HomeSalonsSection() {
  const { data: salons, isLoading, error } = useSalons()

  if (isLoading) {
    return (
      <section id="salons" className="py-20 bg-muted/30">
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
      <section id="salons" className="py-20 bg-muted/30">
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
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos Temples</span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">Trois Sanctuaires du Bien-être</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Chaque établissement offre une atmosphère unique dédiée à votre détente et rajeunissement complets
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {salons?.map((salon) => {
            // Parse opening hours for display
            const openingHours = salon.opening_hours as Record<string, { open: string; close: string }>
            const mondayHours = openingHours?.monday || { open: "10:00", close: "20:00" }
            const rawImageUrl = salon.image_url || `/luxury-spa-${salon.city.toLowerCase()}.jpg`
            const imageUrl = rawImageUrl.trim()

            return (
              <Card
                key={salon.id}
                className="overflow-hidden hover:shadow-xl transition-all duration-300 group border-primary/10 cursor-pointer"
              >
                <div className="relative h-56 bg-muted overflow-hidden">
                  {imageUrl.startsWith('/') ? (
                    <Image
                      src={imageUrl}
                      alt={salon.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg?height=224&width=400"
                      }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={salon.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg?height=224&width=400"
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-serif font-semibold mb-2">{salon.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6">Sanctuaire de bien-être à {salon.city}</p>

                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex items-start gap-3 text-muted-foreground">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                      <span>{salon.address}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Clock className="w-4 h-4 flex-shrink-0 text-primary" />
                      <span>Ouvert jusqu&apos;à {mondayHours.close}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link href={`/salons/${salon.slug}`} className="flex-1">
                      <Button variant="outline" className="w-full border-primary/20 hover:bg-primary/5 cursor-pointer">
                        En savoir plus
                      </Button>
                    </Link>
                    <Link href={`/book/${salon.slug}`} className="flex-1">
                      <Button className="w-full bg-primary hover:bg-primary/90 cursor-pointer">Réserver</Button>
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
