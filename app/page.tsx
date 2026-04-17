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

      {/* Featured Salons - Now fetching from DB */}
      <HomeSalonsSection />

      {/* Services Preview - Now fetching from DB */}
      <HomeServicesSection />

      {/* Why Choose Us */}
      <section className="bg-muted/30 py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-12 text-center md:mb-16">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Pourquoi nous choisir</span>
            <h2 className="mt-2 mb-4 text-3xl font-serif font-bold md:text-5xl">Un massage thailandais qui repose sur le geste</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group home-reveal home-reveal-delay-1">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:-translate-y-1 transition-all">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Gestes thailandais maitrises</h3>
              <p className="text-muted-foreground">
                Pressions palmaires, etirements guides, travail des lignes d'energie et lecture precise des zones contractees.
              </p>
            </div>
            <div className="text-center group home-reveal home-reveal-delay-2">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:-translate-y-1 transition-all">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Cadre calme, sans decor inutile</h3>
              <p className="text-muted-foreground">Cabines silencieuses, linge soigne, accueil clair et temps de soin respecte du debut a la fin.</p>
            </div>
            <div className="text-center group home-reveal home-reveal-delay-3">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:-translate-y-1 transition-all">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Des adresses harmonisees</h3>
              <p className="text-muted-foreground">Le meme niveau d'exigence dans chaque etablissement Les Temples, sans ecart entre l'accueil, le soin et l'hygiene.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[linear-gradient(135deg,rgba(214,171,89,0.96),rgba(171,122,47,0.92))] py-16 text-primary-foreground md:py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="mb-6 text-3xl font-serif font-bold md:text-5xl">Choisissez votre massage thailandais</h2>
          <p className="mx-auto mb-8 max-w-2xl text-base opacity-90 md:text-lg">
            Reservez votre creneau en quelques minutes pour un massage thailandais traditionnel, un soin a l'huile ou une seance duo dans l'adresse de votre choix.
          </p>
          <Button asChild size="lg" variant="secondary" className="cursor-pointer transition-transform hover:scale-105">
            <Link href="/book">Reserver maintenant</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </main>
  )
}
