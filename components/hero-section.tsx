"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useQuery } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/api/client"

export function HeroSection() {
  const { t, mounted } = useTranslations()

  // Fetch therapist count
  const { data: staff } = useQuery({
    queryKey: ["staff-count"],
    queryFn: () => fetchAPI<any[]>("/staff"),
  })

  const therapistCount = staff?.filter((s: any) => s.role === "therapist" && s.is_active).length || 15

  if (!mounted) return null

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
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
      <div className="relative z-10 max-w-7xl mx-auto px-4 w-full">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Tagline */}
            <div className="inline-block rounded-full border border-primary/20 bg-background/35 px-4 py-2 backdrop-blur-sm home-reveal">
              <span className="text-sm font-semibold text-primary tracking-widest uppercase">{t("home.subtitle")}</span>
            </div>

            {/* Main Heading */}
            <div className="home-reveal home-reveal-delay-1">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-foreground leading-tight mb-4 drop-shadow-[0_10px_30px_rgba(0,0,0,0.38)]">
                Le massage
                <br />
                comme <span className="text-primary">art de vivre</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                Trois adresses pensees pour ralentir, respirer et retrouver une sensation rare de calme profond.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 home-reveal home-reveal-delay-2">
              <Link href="/book">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground group shadow-[0_14px_34px_rgba(214,171,89,0.18)]">
                  {t("home.cta_book")}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="#salons">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/8 bg-background/20 backdrop-blur-sm">
                  {t("home.cta_explore")}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8 pt-8 border-t border-primary/10 home-reveal home-reveal-delay-3">
              <div>
                <p className="text-2xl font-bold text-foreground">3</p>
                <p className="text-sm text-muted-foreground">Adresses signature</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">500+</p>
                <p className="text-sm text-muted-foreground">Clients fideles</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{therapistCount}+</p>
                <p className="text-sm text-muted-foreground">Therapeutes experts</p>
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
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex flex-col items-center gap-2 animate-bounce">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Decouvrir</span>
          <div className="w-6 h-10 border-2 border-primary/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  )
}
