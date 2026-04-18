"use client"

import { Card } from "@/components/ui/card"
import { Icon } from "@iconify/react"
import { useServices } from "@/lib/hooks/use-services"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function normalize(value: string | null | undefined) {
  return (value || "").toLowerCase()
}

function getServiceBadge(name: string, category: string | null) {
  const haystack = `${normalize(name)} ${normalize(category)}`

  if (haystack.includes("thai") || haystack.includes("thaï")) return "Nuad Thai"
  if (haystack.includes("huile") || haystack.includes("oil")) return "Huile"
  if (haystack.includes("pied") || haystack.includes("planta")) return "Foot massage"
  if (haystack.includes("duo")) return "Massage duo"
  if (haystack.includes("sport")) return "Recuperation"
  if (haystack.includes("pierre")) return "Chaleur profonde"

  return "Massage"
}

function getServiceDescription(name: string, category: string | null, description: string | null) {
  const haystack = `${normalize(name)} ${normalize(category)}`
  const current = (description || "").trim()
  const genericDescription = !current || [
    "experience unique",
    "ambiance luxueuse",
    "professionnels hautement formes",
    "relaxation",
    "therapeutic massage",
    "soothing full-body massage",
    "couples massage experience",
    "deep tissue massage",
  ].some((snippet) => normalize(current).includes(snippet))

  if (!genericDescription) return current

  if (haystack.includes("thai") || haystack.includes("thaï")) {
    return "Pressions, etirements et mobilisations inspires du Nuad Thai pour liberer le corps en profondeur."
  }

  if (haystack.includes("huile") || haystack.includes("oil")) {
    return "Un rituel a l'huile aux gestes lents et enveloppants, ideal pour apaiser les tensions diffuses."
  }

  if (haystack.includes("pied") || haystack.includes("planta")) {
    return "Un travail precis des pieds et des mollets, ideal lorsque les jambes sont lourdes ou tres sollicitees."
  }

  if (haystack.includes("duo")) {
    return "Deux tables, le meme tempo de soin, pour partager un veritable moment de relachement."
  }

  if (haystack.includes("sport")) {
    return "Un travail cible, plus soutenu, pour accompagner la recuperation et delier les tensions musculaires."
  }

  if (haystack.includes("pierre")) {
    return "La chaleur prolonge le geste, detend les tissus et donne au soin une profondeur plus fondue."
  }

  return "Un rituel mesure, entre pressions et relachement, pour rendre au corps sa souplesse."
}

export function HomeServicesSection() {
  // Fetch all services (no salon filter for homepage)
  const { data: services, isLoading, error } = useServices(undefined, true)

  if (isLoading) {
    return (
      <section id="services" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
        <div className="mb-16 text-center">
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos massages</span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">Une carte courte, des mains sures</h2>
        </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-6 text-center border-primary/10 animate-pulse">
                <div className="h-40 bg-muted rounded-2xl mb-4" />
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
              </Card>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section id="services" className="py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-destructive">Erreur lors du chargement des services</p>
        </div>
      </section>
    )
  }

  // Get unique services (avoid duplicates if same service is in multiple salons)
  const uniqueServices = services?.reduce((acc, service) => {
    if (!acc.find((s) => s.name === service.name)) {
      acc.push(service)
    }
    return acc
  }, [] as typeof services)

  return (
    <section id="services" className="relative overflow-hidden py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,171,89,0.12),transparent_34%),linear-gradient(180deg,rgba(33,26,20,0.34)_0%,rgba(10,9,8,0)_100%)]" />
      <div className="absolute left-1/2 top-16 h-32 w-[38rem] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-4">
        <div className="mb-16 text-center">
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos massages</span>
          <h2 className="mt-2 mb-4 text-4xl font-serif font-bold md:text-5xl">Des rituels penses pour chaque besoin</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Une carte sobre, portee par le geste thai, pour apaiser, relacher ou travailler plus en profondeur.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {uniqueServices?.slice(0, 5).map((service, index) => (
            <Card
              key={service.id}
              className={`group relative gap-0 overflow-hidden rounded-[1.6rem] border border-primary/20 bg-[linear-gradient(180deg,rgba(35,28,22,0.96),rgba(23,19,16,0.98))] p-6 py-0 text-left shadow-[0_24px_50px_rgba(0,0,0,0.18)] transition-all duration-500 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_28px_60px_rgba(214,171,89,0.12)] temple-frame home-reveal ${index === 0 ? "home-reveal-delay-1" : index === 1 ? "home-reveal-delay-2" : index === 2 ? "home-reveal-delay-3" : ""}`}
            >
              <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              <div className="relative mb-5 mt-6 h-44 overflow-hidden rounded-[1.25rem] bg-muted">
                {service.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-primary/5">
                    <Icon icon="solar:spa-bold" className="w-12 h-12 text-primary/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(8,7,6,0.15)_50%,rgba(8,7,6,0.72)_100%)]" />
                <div className="absolute left-4 top-4 rounded-full border border-primary/25 bg-background/55 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-primary backdrop-blur-sm">
                  {getServiceBadge(service.name, service.category)}
                </div>
              </div>
              <div className="mb-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-primary/80">
                <span>{service.duration_minutes} min</span>
                <span>{(service.price_cents / 100).toFixed(2)}€</span>
              </div>
              <h3 className="mb-3 min-h-12 text-lg font-semibold text-foreground">{service.name}</h3>
              <p className="mb-5 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {getServiceDescription(service.name, service.category, service.description)}
              </p>
              <Button asChild variant="outline" className="w-full border-primary/20 bg-background/35 hover:bg-primary/8">
                <Link href="/book">Choisir</Link>
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
