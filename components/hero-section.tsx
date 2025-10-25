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
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 w-full">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Tagline */}
            <div className="inline-block">
              <span className="text-sm font-semibold text-primary tracking-widest uppercase">{t("home.subtitle")}</span>
            </div>

            {/* Main Heading */}
            <div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-foreground leading-tight mb-4">
                {t("home.title")} <span className="text-primary">Sérénité</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">{t("home.description")}</p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/book">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground group">
                  {t("home.cta_book")}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="#salons">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/5 bg-transparent">
                  {t("home.cta_explore")}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8 pt-8 border-t border-primary/10">
              <div>
                <p className="text-2xl font-bold text-foreground">3</p>
                <p className="text-sm text-muted-foreground">{t("home.locations")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">500+</p>
                <p className="text-sm text-muted-foreground">{t("home.clients")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{therapistCount}+</p>
                <p className="text-sm text-muted-foreground">{t("home.therapists")}</p>
              </div>
            </div>
          </div>

          {/* Right Side - Decorative Element */}
          <div className="hidden md:flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-md">
              {/* Floating Cards */}
              <div className="absolute top-0 right-0 w-48 h-64 bg-primary/10 rounded-3xl backdrop-blur-sm border border-primary/20 p-6 shadow-xl transform hover:scale-105 transition-transform duration-300">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-3 bg-primary/20 rounded w-3/4" />
                    <div className="h-3 bg-primary/20 rounded w-1/2" />
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 w-48 h-64 bg-primary/5 rounded-3xl backdrop-blur-sm border border-primary/10 p-6 shadow-lg transform hover:scale-105 transition-transform duration-300">
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
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Scroll</span>
          <div className="w-6 h-10 border-2 border-primary/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  )
}
