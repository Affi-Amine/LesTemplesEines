"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, MapPin, Sparkles } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { useSalons } from "@/lib/hooks/use-salons"

export function HeroSection() {
  const { data: salons } = useSalons()

  const { data: staff } = useQuery({
    queryKey: ["staff-count"],
    queryFn: () => fetchAPI<any[]>("/staff"),
  })

  const therapistCount = staff?.filter((s: any) => s.role === "therapist" && s.is_active).length || 15
  const activeSalonCount = salons?.filter((salon) => salon.is_active).length || 3

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden pt-24 md:min-h-screen md:pt-20">
      <div className="absolute inset-0 z-0">
        <Image
          src="/luxury-spa-massage-relaxation.jpg"
          alt="Cabine de massage thailandais Les Temples"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,8,6,0.92)_0%,rgba(11,9,7,0.76)_42%,rgba(10,8,6,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(214,171,89,0.16),transparent_24%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="max-w-3xl space-y-7 md:space-y-8">
            <div className="home-reveal inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/35 px-4 py-2 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-semibold tracking-widest text-primary uppercase">Rituels inspires de Thaïlande</span>
            </div>

            <div className="home-reveal home-reveal-delay-1">
              <h1 className="mb-5 text-4xl font-serif font-bold leading-[0.95] text-foreground drop-shadow-[0_10px_30px_rgba(0,0,0,0.38)] sm:text-5xl md:text-6xl lg:text-7xl">
                L&apos;art du massage thai,
                <br />
                <span className="text-primary">travaille avec tenue.</span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-[#d8cebf] sm:text-lg">
                Pressions profondes, etirements guides, lignes d&apos;energie, huile quand elle sert le geste. Une interpretation sobre des rituels venus de Thaïlande, pensee pour relacher sans folklore.
              </p>
            </div>

            <div className="home-reveal home-reveal-delay-2 flex flex-wrap gap-3 text-sm text-foreground/80">
              <span className="rounded-full border border-primary/20 bg-background/30 px-4 py-2 backdrop-blur-sm">Thai traditionnel</span>
              <span className="rounded-full border border-primary/20 bg-background/30 px-4 py-2 backdrop-blur-sm">Huile chaude</span>
              <span className="rounded-full border border-primary/20 bg-background/30 px-4 py-2 backdrop-blur-sm">Duo & relaxation</span>
            </div>

            <div className="home-reveal home-reveal-delay-2 flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4">
              <Button asChild size="lg" className="group w-full bg-primary text-primary-foreground shadow-[0_14px_34px_rgba(214,171,89,0.18)] hover:bg-primary/90 sm:w-auto">
                <Link href="/book" className="w-full sm:w-auto">
                  Reserver maintenant
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full border-primary/30 bg-background/20 backdrop-blur-sm hover:bg-primary/8 sm:w-auto">
                <Link href="/gift" className="w-full sm:w-auto">
                  Offrir une carte cadeau
                </Link>
              </Button>
            </div>

            <div className="home-reveal home-reveal-delay-3 grid grid-cols-3 gap-4 border-t border-primary/10 pt-6 sm:pt-8 md:flex md:gap-8">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{activeSalonCount}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">{activeSalonCount > 1 ? "Adresses Les Temples" : "Adresse Les Temples"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">500+</p>
                <p className="text-xs text-muted-foreground sm:text-sm">Clients reguliers</p>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{therapistCount}+</p>
                <p className="text-xs text-muted-foreground sm:text-sm">Therapeutes en massage</p>
              </div>
            </div>
          </div>

          <div className="temple-panel temple-frame home-reveal home-reveal-delay-2 hidden rounded-[1.75rem] p-6 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">Esprit du lieu</p>
            <h2 className="mt-4 font-serif text-3xl font-semibold text-foreground">Bangkok dans le geste, Paris dans la tenue.</h2>
            <div className="temple-divider my-6" />
            <div className="space-y-4 text-sm leading-7 text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Rituel precis</p>
                <p>Thai traditionnel, huile ou duo selon la lecture du corps et l&apos;intensite souhaitee.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Cadre calme</p>
                <p>Bois sombres, lumiere basse, accueil net et sans decor bavard.</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-background/20 p-4 text-foreground/85">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Plusieurs adresses pour retrouver la meme qualite de soin, salon apres salon.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 transform sm:bottom-8">
        <div className="flex flex-col items-center gap-2 animate-bounce">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Decouvrir</span>
          <div className="flex h-9 w-5 items-start justify-center rounded-full border-2 border-primary/30 p-1.5 sm:h-10 sm:w-6 sm:p-2">
            <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  )
}
