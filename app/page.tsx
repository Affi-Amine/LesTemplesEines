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
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16 text-center">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Pourquoi nous choisir</span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">La Différence Les Temples</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Thérapeutes Experts</h3>
              <p className="text-muted-foreground">
                Professionnels hautement formés avec des années d&apos;expérience spécialisée
              </p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Expérience Premium</h3>
              <p className="text-muted-foreground">Ambiance luxueuse et attention personnalisée à chaque visite</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Plusieurs Emplacements</h3>
              <p className="text-muted-foreground">Trois sanctuaires à Paris, Lyon et Marseille</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">Prêt à vous échapper?</h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Réservez votre expérience de massage parfaite dès aujourd&apos;hui et découvrez le summum du bien-être
          </p>
          <Link href="/book">
            <Button size="lg" variant="secondary" className="hover:scale-105 transition-transform cursor-pointer">
              Réserver Votre Expérience
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
