"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MapPin, Clock } from "lucide-react"
import { Icon } from "@iconify/react"
import { useSalons } from "@/lib/hooks/use-salons"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"

export function HomeSalonsSection() {
  const { data: salons, isLoading, error } = useSalons()
  const activeSalons = salons?.filter((salon) => salon.is_active) ?? []
  const salonCount = activeSalons.length
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 4500,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    })
  )
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: false,
    loop: false,
  }, [autoplayPlugin.current])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap())
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
    }
    onSelect()
    emblaApi.on("select", onSelect)
    emblaApi.on("reInit", onSelect)

    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("reInit", onSelect)
    }
  }, [emblaApi])

  if (isLoading) {
    return (
      <section id="salons" className="bg-transparent py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-12 text-center md:mb-16">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos maisons de massage thai</span>
            <h2 className="mt-2 mb-4 text-3xl font-serif font-bold md:text-5xl">Des adresses pensees pour le meme niveau de soin</h2>
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
    <section id="salons" className="bg-transparent py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-destructive">Erreur lors du chargement des salons</p>
        </div>
      </section>
    )
  }

  return (
    <section id="salons" className="relative overflow-hidden bg-muted/30 py-16 md:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(214,171,89,0.08),transparent_25%),radial-gradient(circle_at_85%_78%,rgba(214,171,89,0.06),transparent_28%)]" />
      <div className="max-w-7xl mx-auto px-4">
        <div className="relative mb-12 text-center md:mb-16">
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos salons</span>
          <h2 className="mt-2 mb-4 text-3xl font-serif font-bold md:text-5xl">
            {salonCount > 0 ? `${salonCount} adresse${salonCount > 1 ? "s" : ""}, un meme geste thai` : "Nos adresses Les Temples"}
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            Chaque etablissement reprend le meme langage: bois sombres, lumiere basse, accueil calme et massage thailandais travaille avec precision, sans folklore inutile.
          </p>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-20 bg-gradient-to-r from-background via-background/60 to-transparent lg:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-20 bg-gradient-to-l from-background via-background/60 to-transparent lg:block" />

          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4 md:gap-6">
          {activeSalons.map((salon, index) => {
            // Parse opening hours for display
            const openingHours = salon.opening_hours as Record<string, { open: string; close: string }>
            const mondayHours = openingHours?.monday || { open: "10:00", close: "20:00" }

            return (
              <Card
                key={salon.id}
                className={`min-w-0 flex-[0_0_88%] gap-0 py-0 sm:flex-[0_0_68%] lg:flex-[0_0_38%] xl:flex-[0_0_32%] rounded-[1.5rem] border-primary/20 bg-card/92 backdrop-blur-sm transition-all duration-500 group cursor-pointer hover:-translate-y-1 hover:shadow-xl temple-frame home-reveal ${index === 0 ? "home-reveal-delay-1" : index === 1 ? "home-reveal-delay-2" : "home-reveal-delay-3"}`}
              >
                <div className="relative h-52 overflow-hidden bg-muted sm:h-56">
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
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-serif font-semibold leading-tight sm:text-2xl">{salon.name}</h3>
                      <p className="text-sm text-primary/90 mt-1">{salon.city}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
                      Thai
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

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button asChild variant="outline" className="flex-1 w-full border-primary/20 bg-transparent cursor-pointer hover:bg-primary/8">
                      <Link href={`/salons/${salon.slug}`}>Decouvrir l'adresse</Link>
                    </Button>
                    <Button asChild className="flex-1 w-full bg-primary shadow-[0_10px_24px_rgba(214,171,89,0.16)] cursor-pointer hover:bg-primary/90">
                      <Link href={`/book/${salon.slug}`}>Reserver ici</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {activeSalons.map((_, index) => (
                <button
                  key={index}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={`h-2.5 rounded-full transition-all ${selectedIndex === index ? "w-10 bg-primary" : "w-2.5 bg-primary/30 hover:bg-primary/50"}`}
                  aria-label={`Aller au salon ${index + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <Button variant="outline" size="icon" className="h-10 w-10 border-primary/25 bg-background/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40" onClick={scrollPrev} disabled={!canScrollPrev}>
                <Icon icon="solar:alt-arrow-left-bold" className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 border-primary/25 bg-background/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40" onClick={scrollNext} disabled={!canScrollNext}>
                <Icon icon="solar:alt-arrow-right-bold" className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
