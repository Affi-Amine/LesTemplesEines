import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { HomeSalonsSection } from "@/components/sections/home-salons-section"
import { HomeServicesSection } from "@/components/sections/home-services-section"
import Link from "next/link"
import { Users, Sparkles, MapPin } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <HeroSection />

      <HomeSalonsSection />

      <HomeServicesSection />

      <section className="bg-muted/20 py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-10 text-center md:mb-16">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Pourquoi nous choisir</span>
            <h2 className="mt-2 mb-3 text-3xl font-serif font-bold md:mb-4 md:text-5xl">Une signature de soin sobre et raffinée</h2>
            <p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground sm:max-w-2xl sm:text-base">
              L&apos;inspiration est thaï, l&apos;expérience est tenue : un vrai calme, des gestes précis et des adresses cohérentes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3 md:gap-8">
            <div className="temple-panel temple-frame text-center group home-reveal home-reveal-soft home-reveal-delay-1 rounded-[1.25rem] p-6 md:rounded-[1.5rem] md:p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-all group-hover:-translate-y-1 group-hover:bg-primary/20 md:mb-6 md:h-16 md:w-16">
                <Users className="h-7 w-7 text-primary md:h-8 md:w-8" />
              </div>
              <h3 className="mb-2 text-lg font-semibold md:mb-3 md:text-xl">Un geste thaï maîtrisé</h3>
              <p className="text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
                Pressions, étirements et travail des lignes pour délier les tensions avec précision.
              </p>
            </div>
            <div className="temple-panel temple-frame text-center group home-reveal home-reveal-soft home-reveal-delay-2 rounded-[1.25rem] p-6 md:rounded-[1.5rem] md:p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-all group-hover:-translate-y-1 group-hover:bg-primary/20 md:mb-6 md:h-16 md:w-16">
                <Sparkles className="h-7 w-7 text-primary md:h-8 md:w-8" />
              </div>
              <h3 className="mb-2 text-lg font-semibold md:mb-3 md:text-xl">Un cadre calme et feutré</h3>
              <p className="text-sm leading-6 text-muted-foreground md:text-base md:leading-7">Cabines silencieuses, linge soigné et temps de soin respecté du début à la fin.</p>
            </div>
            <div className="temple-panel temple-frame text-center group home-reveal home-reveal-soft home-reveal-delay-3 rounded-[1.25rem] p-6 md:rounded-[1.5rem] md:p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-all group-hover:-translate-y-1 group-hover:bg-primary/20 md:mb-6 md:h-16 md:w-16">
                <MapPin className="h-7 w-7 text-primary md:h-8 md:w-8" />
              </div>
              <h3 className="mb-2 text-lg font-semibold md:mb-3 md:text-xl">Une exigence constante</h3>
              <p className="text-sm leading-6 text-muted-foreground md:text-base md:leading-7">Le même niveau d&apos;attention dans chaque maison, de l&apos;accueil au soin.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="temple-frame home-reveal home-reveal-soft overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(214,171,89,0.96),rgba(171,122,47,0.92))] px-5 py-10 text-primary-foreground md:rounded-[1.75rem] md:px-10 md:py-12">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="text-center lg:text-left">
                <h2 className="mb-3 text-3xl font-serif font-bold md:mb-4 md:text-5xl">Choisissez votre moment</h2>
                <p className="mx-auto max-w-xl text-sm leading-7 opacity-90 md:max-w-2xl md:text-lg lg:mx-0">
                  Réservez en quelques instants le rituel qui convient à votre corps et à votre tempo.
                </p>
              </div>
              <div className="flex justify-center lg:justify-end">
                <Button asChild size="lg" variant="secondary" className="cursor-pointer transition-transform hover:scale-105">
                  <Link href="/book">Réserver</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
