"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { Sparkles } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { useSalons } from "@/lib/hooks/use-salons"

export function HeroSection() {
  useSalons()
  useQuery({
    queryKey: ["staff-count"],
    queryFn: () => fetchAPI<any[]>("/staff"),
  })

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden pt-24 md:min-h-screen md:pt-20">
      <div className="absolute inset-0 z-0">
        <Image
          src="/luxury-spa-massage-relaxation.jpg"
          alt="Cabine de massage thaïlandais Les Temples"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,8,6,0.92)_0%,rgba(11,9,7,0.76)_42%,rgba(10,8,6,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(214,171,89,0.16),transparent_24%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4">
        <div className="max-w-3xl space-y-6 sm:space-y-7 md:space-y-8">
          <div className="home-reveal inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-background/35 px-3 py-2 backdrop-blur-sm sm:px-4">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-primary sm:text-sm">Massage thaï à Paris</span>
          </div>

          <div className="home-reveal home-reveal-delay-1">
            <h1 className="mb-4 max-w-4xl text-4xl font-serif font-bold leading-[0.95] text-foreground drop-shadow-[0_10px_30px_rgba(0,0,0,0.38)] sm:mb-5 sm:text-5xl md:text-6xl lg:text-7xl">
              Le massage thaï,
              <br />
              <span className="text-primary">détendre le corps et apaiser l’esprit.</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-[#d8cebf] sm:text-base md:text-lg">
              Réservez votre soin, offrez une carte cadeau ou choisissez un forfait en quelques minutes, simplement et sans complication.
            </p>
          </div>

          <div className="home-reveal home-reveal-delay-2 flex flex-wrap gap-2.5 text-sm text-foreground/85">
            <span className="rounded-full border border-primary/20 bg-background/30 px-3 py-2 backdrop-blur-sm">Rituels thaï traditionnels</span>
            <span className="rounded-full border border-primary/20 bg-background/30 px-3 py-2 backdrop-blur-sm">Massages relaxants</span>
            <span className="rounded-full border border-primary/20 bg-background/30 px-3 py-2 backdrop-blur-sm">Forfaits et cartes cadeaux</span>
          </div>

          <div className="home-reveal home-reveal-delay-2 pt-2 sm:pt-4">
            <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
              <Button asChild size="lg" className="w-full bg-primary text-primary-foreground shadow-[0_14px_34px_rgba(214,171,89,0.18)] hover:bg-primary/90">
                <Link href="/book" className="w-full">
                  Réserver
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full border-primary/30 bg-background/20 backdrop-blur-sm hover:bg-primary/8">
                <Link href="/gift" className="w-full">
                  Carte cadeau
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full border-primary/30 bg-background/20 backdrop-blur-sm hover:bg-primary/8">
                <Link href="/forfaits" className="w-full">
                  Forfaits
                </Link>
              </Button>
            </div>
          </div>

          <div className="home-reveal home-reveal-delay-3 grid grid-cols-1 gap-3 border-t border-primary/10 pt-6 sm:grid-cols-3 sm:gap-4 sm:pt-8 md:max-w-2xl">
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground">5</p>
              <p className="text-sm text-muted-foreground">Adresses à Paris</p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground">20 000+</p>
              <p className="text-sm text-muted-foreground">Clients accueillis</p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground">50+</p>
              <p className="text-sm text-muted-foreground">Thérapeutes</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
