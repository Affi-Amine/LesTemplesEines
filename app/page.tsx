import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { HomeSalonsSection } from "@/components/sections/home-salons-section"
import { HomeServicesSection } from "@/components/sections/home-services-section"
import Link from "next/link"
import { ArrowRight, Clock3, Flower2, HandHeart, MapPin, Sparkles, Users } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <Navbar />

      <HeroSection />

      <section className="section-shell relative py-16 md:py-24">
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div className="home-reveal">
            <span className="section-kicker">Esprit du lieu</span>
            <h2 className="mt-6 max-w-3xl font-serif text-4xl font-semibold leading-tight text-foreground md:text-6xl">
              Une page d&apos;accueil doit deja faire sentir
              <span className="text-primary"> le calme, la precision et la tenue.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#d4c6af] md:text-lg">
              Les Temples n&apos;est pas un catalogue de soins pose sur fond sombre. C&apos;est une maison de massage thailandais qui doit inspirer confiance, desir de reservation et impression de niveau des la premiere seconde.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                icon: HandHeart,
                title: "Technique lisible",
                text: "On parle des mains, des pressions, des etirements et du resultat attendu. Pas de promesses vagues.",
              },
              {
                icon: Sparkles,
                title: "Luxe sans surcharge",
                text: "Bois sombre, or mat, lumiere basse et surfaces nettes. La page reste respirable et haut de gamme.",
              },
              {
                icon: Users,
                title: "Confiance immediate",
                text: "Les arguments clefs arrivent vite: praticiennes, niveau d'exigence, reservation et regularite entre salons.",
              },
              {
                icon: Flower2,
                title: "Rythme editorial",
                text: "On alterne impact, respiration et preuves concretes pour guider l'oeil jusqu'a la prise de rendez-vous.",
              },
            ].map((item, index) => (
              <article
                key={item.title}
                className={`temple-surface temple-frame home-reveal rounded-[1.75rem] p-6 ${index % 2 === 0 ? "home-reveal-delay-1" : "home-reveal-delay-2"}`}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <HomeSalonsSection />

      <section id="rituels" className="section-shell py-16 md:py-24">
        <div className="relative mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <span className="section-kicker">Rituels</span>
            <h2 className="mt-6 font-serif text-4xl font-semibold text-foreground md:text-6xl">Un parcours simple, mais traite avec exigence</h2>
            <p className="mt-5 text-base leading-8 text-[#d4c6af] md:text-lg">
              Ce qui fait premium ici, ce n&apos;est pas l&apos;ornement. C&apos;est la maitrise du rythme: accueil, lecture du besoin, protocole juste, sortie propre.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="temple-surface temple-frame home-reveal rounded-[2rem] p-7 md:p-10">
              <div className="grid gap-8 md:grid-cols-3">
                {[
                  {
                    number: "01",
                    title: "Entrer",
                    text: "Accueil calme, quelques questions utiles, aucune friction inutile. Le ton est pose des l'arrivee.",
                  },
                  {
                    number: "02",
                    title: "Recevoir",
                    text: "Thai traditionnel, huile ou duo selon le besoin. Le geste s'adapte sans perdre sa ligne.",
                  },
                  {
                    number: "03",
                    title: "Repartir",
                    text: "On termine net. Le corps est plus mobile, la tete plus basse, et l'envie de revenir est claire.",
                  },
                ].map((step, index) => (
                  <div key={step.number} className={index > 0 ? "border-t border-primary/10 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0" : ""}>
                    <p className="text-sm uppercase tracking-[0.3em] text-primary/80">{step.number}</p>
                    <h3 className="mt-3 font-serif text-3xl font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              {[
                {
                  icon: Clock3,
                  title: "Temps utiles",
                  text: "Formats 60, 90 ou davantage selon les adresses, avec une promesse claire sur le contenu du soin.",
                },
                {
                  icon: MapPin,
                  title: "Adresses alignees",
                  text: "Le meme niveau de proprete, le meme langage visuel et la meme qualite d'accueil d'un salon a l'autre.",
                },
                {
                  icon: Sparkles,
                  title: "Experience memorisable",
                  text: "La page installe deja cette impression: silencieuse, precise, chaude et sure d'elle.",
                },
              ].map((item, index) => (
                <article key={item.title} className={`temple-surface home-reveal rounded-[1.75rem] p-6 ${index === 0 ? "home-reveal-delay-1" : index === 1 ? "home-reveal-delay-2" : "home-reveal-delay-3"}`}>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-2xl font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <HomeServicesSection />

      <section className="section-shell bg-muted/20 py-16 md:py-24">
        <div className="relative mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center md:mb-16">
            <span className="section-kicker">Pourquoi nous choisir</span>
            <h2 className="mt-6 mb-4 text-4xl font-serif font-semibold md:text-6xl">Ici, le soin ne bavarde pas</h2>
            <p className="mx-auto max-w-2xl text-base leading-8 text-[#d4c6af]">
              La credibilite vient de trois choses: la technique, le cadre et la constance. La home devait le raconter plus fort.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="temple-surface text-center group home-reveal home-reveal-delay-1 rounded-[1.75rem] p-8">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-all group-hover:-translate-y-1 group-hover:bg-primary/20">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-3 font-serif text-3xl font-semibold">Une vraie technique de main</h3>
              <p className="text-muted-foreground leading-7">
                Pressions palmaires, etirements, relances, points de tension: le soin avance avec intention, pas avec automatismes.
              </p>
            </div>
            <div className="temple-surface text-center group home-reveal home-reveal-delay-2 rounded-[1.75rem] p-8">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-all group-hover:-translate-y-1 group-hover:bg-primary/20">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-3 font-serif text-3xl font-semibold">Cadre calme, sans decor inutile</h3>
              <p className="text-muted-foreground leading-7">Lumiere basse, cabines silencieuses, linge propre, accueil net. Rien de plus que ce qu&apos;il faut pour bien recevoir.</p>
            </div>
            <div className="temple-surface text-center group home-reveal home-reveal-delay-3 rounded-[1.75rem] p-8">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-all group-hover:-translate-y-1 group-hover:bg-primary/20">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-3 font-serif text-3xl font-semibold">Des adresses harmonisees</h3>
              <p className="text-muted-foreground leading-7">Quel que soit le salon, vous retrouvez le meme niveau de soin, la meme tenue, la meme exigence de proprete.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="temple-frame overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(214,171,89,0.96),rgba(171,122,47,0.92))] px-6 py-12 text-primary-foreground shadow-[0_30px_80px_rgba(171,122,47,0.28)] md:px-12 md:py-16">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-primary-foreground/80">Reservation</p>
                <h2 className="mt-4 max-w-3xl font-serif text-4xl font-semibold md:text-6xl">Choisissez votre prochain soin.</h2>
                <p className="mt-5 max-w-2xl text-base opacity-90 md:text-lg">
                  Reservez votre creneau en quelques minutes pour un massage traditionnel, un soin a l&apos;huile ou une seance duo dans l&apos;adresse de votre choix.
                </p>
              </div>
              <Button asChild size="lg" variant="secondary" className="h-12 rounded-full px-7 transition-transform hover:scale-[1.02]">
                <Link href="/book">
                  Reserver maintenant
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
