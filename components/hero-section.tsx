"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Check, Clock3, MapPinned, Sparkles } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { useSalons } from "@/lib/hooks/use-salons"

export function HeroSection() {
  const { data: salons } = useSalons()

  // Fetch therapist count
  const { data: staff } = useQuery({
    queryKey: ["staff-count"],
    queryFn: () => fetchAPI<any[]>("/staff"),
  })

  const therapistCount = staff?.filter((s: any) => s.role === "therapist" && s.is_active).length || 15
  const activeSalonCount = salons?.filter((salon) => salon.is_active).length || 3

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden pt-24 md:min-h-screen md:pt-20">
      {/* Background Image with Overlay */}
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

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_24rem]">
          <div className="max-w-4xl space-y-7 md:space-y-8">
            <div className="home-reveal inline-flex rounded-full border border-primary/20 bg-background/35 px-4 py-2 backdrop-blur-sm">
              <span className="text-sm font-semibold tracking-widest text-primary uppercase">Les Temples • art du massage venu de Bangkok</span>
            </div>

            <div className="home-reveal home-reveal-delay-1">
              <h1 className="mb-5 text-5xl font-serif font-semibold leading-[0.9] text-foreground drop-shadow-[0_10px_30px_rgba(0,0,0,0.38)] sm:text-6xl md:text-7xl lg:text-[6.2rem]">
                Une maison de massage thai
                <br />
                <span className="text-primary">qui tient sa promesse.</span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-[#ddd1bf] sm:text-lg md:text-xl">
                Pressions profondes, lignes d&apos;energie, etirements guides, huile chaude quand il faut. Une lecture serieuse du massage thailandais, dans un lieu concu pour couper le bruit et remettre le corps d&apos;aplomb.
              </p>
            </div>

            <div className="home-reveal home-reveal-delay-2 flex flex-wrap gap-3 text-sm text-[#e6dccd]">
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 backdrop-blur-sm">Therapeutes experimentees</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 backdrop-blur-sm">Cabines sobres et silencieuses</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 backdrop-blur-sm">Reservation simple, sans friction</span>
            </div>

            <div className="home-reveal home-reveal-delay-2 flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4">
              <Button asChild size="lg" className="group h-12 w-full rounded-full bg-primary px-7 text-primary-foreground shadow-[0_14px_34px_rgba(214,171,89,0.18)] hover:bg-primary/90 sm:w-auto">
                <Link href="/book" className="w-full sm:w-auto">
                  Prendre rendez-vous
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 w-full rounded-full border-primary/30 bg-background/20 px-7 backdrop-blur-sm hover:bg-primary/8 sm:w-auto">
                <Link href="/gift" className="w-full sm:w-auto">
                  Offrir une carte cadeau
                </Link>
              </Button>
            </div>

            <div className="home-reveal home-reveal-delay-3 grid grid-cols-3 gap-4 border-t border-primary/10 pt-6 sm:pt-8 md:max-w-2xl">
              <div className="min-w-0">
                <p className="text-2xl font-semibold text-foreground md:text-3xl">{activeSalonCount}</p>
                <p className="text-xs text-[#c3b39a] sm:text-sm">{activeSalonCount > 1 ? "Adresses Les Temples" : "Adresse Les Temples"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold text-foreground md:text-3xl">500+</p>
                <p className="text-xs text-[#c3b39a] sm:text-sm">Clients reguliers</p>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold text-foreground md:text-3xl">{therapistCount}+</p>
                <p className="text-xs text-[#c3b39a] sm:text-sm">Therapeutes en massage</p>
              </div>
            </div>
          </div>

          <div className="home-reveal home-reveal-delay-3 hidden lg:block">
            <div className="temple-surface temple-frame rounded-[2rem] p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Rituel signature</p>
                  <h2 className="mt-2 font-serif text-3xl text-foreground">60 a 90 min</h2>
                </div>
                <div className="rounded-full border border-primary/20 bg-primary/10 p-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  ["Accueil sobre", "On cible les zones de tension et l'intensite juste."],
                  ["Protocole adapte", "Thai traditionnel, huile ou duo selon l'etat du corps."],
                  ["Sortie nette", "Une sensation plus mobile, sans mise en scene superflue."],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-[1.25rem] border border-white/8 bg-black/18 p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="rounded-full border border-primary/20 bg-primary/10 p-1.5">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{title}</p>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-white/8 bg-black/18 p-4">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <Clock3 className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-[0.22em]">Amplitude</span>
                  </div>
                  <p className="text-sm text-[#ddd1bf]">Du midi aux fins de journee selon le salon choisi.</p>
                </div>
                <div className="rounded-[1.25rem] border border-white/8 bg-black/18 p-4">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <MapPinned className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-[0.22em]">Adresses</span>
                  </div>
                  <p className="text-sm text-[#ddd1bf]">Des lieux harmonises pour retrouver la meme qualite de soin.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
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
