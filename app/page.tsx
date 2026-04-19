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

      <section className="bg-muted/20 py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-12 text-center md:mb-16">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Pourquoi nous choisir</span>
            <h2 className="mt-2 mb-4 text-3xl font-serif font-bold md:text-5xl">Une signature de soin sobre et raffinée</h2>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              L&apos;inspiration est thaï, l&apos;expérience est tenue : un vrai calme, des gestes précis et des adresses cohérentes.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="temple-panel temple-frame text-center group home-reveal home-reveal-delay-1 rounded-[1.5rem] p-8">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:-translate-y-1 transition-all">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Un geste thaï maîtrisé</h3>
              <p className="text-muted-foreground leading-7">
                Pressions, étirements et travail des lignes pour délier les tensions avec précision.
              </p>
            </div>
            <div className="temple-panel temple-frame text-center group home-reveal home-reveal-delay-2 rounded-[1.5rem] p-8">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:-translate-y-1 transition-all">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Un cadre calme et feutré</h3>
              <p className="text-muted-foreground leading-7">Cabines silencieuses, linge soigné et temps de soin respecté du début à la fin.</p>
            </div>
            <div className="temple-panel temple-frame text-center group home-reveal home-reveal-delay-3 rounded-[1.5rem] p-8">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:-translate-y-1 transition-all">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Une exigence constante</h3>
              <p className="text-muted-foreground leading-7">Le même niveau d&apos;attention dans chaque maison, de l&apos;accueil au soin.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="temple-frame overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,rgba(214,171,89,0.96),rgba(171,122,47,0.92))] px-6 py-12 text-primary-foreground md:px-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="text-center lg:text-left">
                <h2 className="mb-4 text-3xl font-serif font-bold md:text-5xl">Choisissez votre moment</h2>
                <p className="mx-auto max-w-2xl text-base opacity-90 md:text-lg lg:mx-0">
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
