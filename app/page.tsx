import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import Link from "next/link"
import { salons, services } from "@/lib/mock-data"
import Image from "next/image"
import { MapPin, Clock, Users, Sparkles } from "lucide-react"
import { t } from "@/lib/i18n/get-translations"

export default function Home() {
  const locale = "fr"

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <HeroSection />

      {/* Featured Salons */}
      <section id="salons" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16 text-center">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              {t(locale, "nav.salons")}
            </span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">Trois Sanctuaires du Bien-être</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Chaque établissement offre une atmosphère unique dédiée à votre détente et rajeunissement complets
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {salons.map((salon) => (
              <Card
                key={salon.id}
                className="overflow-hidden hover:shadow-xl transition-all duration-300 group border-primary/10"
              >
                <div className="relative h-56 bg-muted overflow-hidden">
                  <Image
                    src={salon.image || "/placeholder.svg?height=224&width=400&query=luxury spa"}
                    alt={salon.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-serif font-semibold mb-2">{salon.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{salon.description}</p>

                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex items-start gap-3 text-muted-foreground">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                      <span>{salon.address}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Clock className="w-4 h-4 flex-shrink-0 text-primary" />
                      <span>Ouvert jusqu&apos;à {salon.hours.monday.close}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link href={`/salons/${salon.slug}`} className="flex-1">
                      <Button variant="outline" className="w-full border-primary/20 hover:bg-primary/5 bg-transparent">
                        En savoir plus
                      </Button>
                    </Link>
                    <Link href={`/book/${salon.slug}`} className="flex-1">
                      <Button className="w-full bg-primary hover:bg-primary/90">Réserver</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section id="services" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16 text-center">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos Services</span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">Soins Thérapeutiques</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Découvrez notre gamme de services de massage et de bien-être spécialisés
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {services.map((service) => (
              <Card
                key={service.id}
                className="p-6 text-center hover:shadow-lg transition-all duration-300 group border-primary/10 hover:border-primary/30"
              >
                <div className="relative h-40 mb-4 bg-muted rounded-2xl overflow-hidden">
                  <Image
                    src={service.image || "/placeholder.svg?height=160&width=200&query=massage therapy"}
                    alt={service.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <h3 className="font-semibold mb-2 text-foreground">{service.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{service.duration} minutes</p>
                <p className="text-xl font-bold text-primary">{service.price}€</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

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
            <Button size="lg" variant="secondary" className="hover:scale-105 transition-transform">
              Réserver Votre Expérience
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
