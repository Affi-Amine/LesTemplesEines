"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"
import { useSalons } from "@/lib/hooks/use-salons"

export function HeroSection() {
  const { t, mounted } = useTranslations()
  const { data: salons } = useSalons()

  // Fetch therapist count
  const { data: staff } = useQuery({
    queryKey: ["staff-count"],
    queryFn: () => fetchAPI<any[]>("/staff"),
  })

  const therapistCount = staff?.filter((s: any) => s.role === "therapist" && s.is_active).length || 15
  const activeSalonCount = salons?.filter((salon) => salon.is_active).length || 3

  if (!mounted) return null

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden pt-24 md:min-h-screen md:pt-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/luxury-spa-massage-relaxation.jpg"
          alt="Luxury spa background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,8,6,0.92)_0%,rgba(11,9,7,0.76)_42%,rgba(10,8,6,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(214,171,89,0.16),transparent_24%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
          {/* Left Content */}
          <div className="space-y-7 md:space-y-8">
            {/* Tagline */}
            <div className="home-reveal inline-block rounded-full border border-primary/20 bg-background/35 px-4 py-2 backdrop-blur-sm">
              <span className="text-sm font-semibold text-primary tracking-widest uppercase">{t("home.subtitle")}</span>
            </div>

            {/* Main Heading */}
            <div className="home-reveal home-reveal-delay-1">
              <h1 className="mb-4 text-4xl font-serif font-bold leading-[0.95] text-foreground drop-shadow-[0_10px_30px_rgba(0,0,0,0.38)] sm:text-5xl md:text-6xl lg:text-7xl">
                Le massage
                <br />
                comme <span className="text-primary">art de vivre</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Trois adresses pensees pour ralentir, respirer et retrouver une sensation rare de calme profond.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="home-reveal home-reveal-delay-2 flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4">
              <Link href="/book" className="w-full sm:w-auto">
                <Button size="lg" className="group w-full bg-primary text-primary-foreground shadow-[0_14px_34px_rgba(214,171,89,0.18)] hover:bg-primary/90 sm:w-auto">
                  {t("home.cta_book")}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="#salons" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full border-primary/30 bg-background/20 backdrop-blur-sm hover:bg-primary/8 sm:w-auto">
                  {t("home.cta_explore")}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="home-reveal home-reveal-delay-3 grid grid-cols-3 gap-4 border-t border-primary/10 pt-6 sm:pt-8 md:flex md:gap-8">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{activeSalonCount}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">{activeSalonCount > 1 ? "Salons signature" : "Salon signature"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">500+</p>
                <p className="text-xs text-muted-foreground sm:text-sm">Clients fideles</p>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{therapistCount}+</p>
                <p className="text-xs text-muted-foreground sm:text-sm">Therapeutes experts</p>
              </div>
            </div>
          </div>

          {/* Right Side - Decorative Element */}
          <div className="hidden md:flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-md">
              {/* Floating Cards */}
              <div className="absolute top-0 right-0 w-48 h-64 bg-background/35 rounded-3xl backdrop-blur-sm border border-primary/20 p-6 shadow-xl transform hover:scale-105 transition-transform duration-300 soft-float soft-glow">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-3 bg-primary/20 rounded w-3/4" />
                    <div className="h-3 bg-primary/20 rounded w-1/2" />
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 w-48 h-64 bg-background/25 rounded-3xl backdrop-blur-sm border border-primary/10 p-6 shadow-lg transform hover:scale-105 transition-transform duration-300 soft-float [animation-delay:1.8s]">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-3 bg-primary/10 rounded w-3/4" />
                    <div className="h-3 bg-primary/10 rounded w-1/2" />
                  </div>
                </div>
              </div>

              <div className="absolute left-12 top-10 h-24 w-24 rounded-full border border-primary/20 bg-primary/8 blur-3xl" />
              <div className="absolute bottom-14 right-12 h-20 w-20 rounded-full border border-primary/15 bg-primary/10 blur-2xl" />
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
