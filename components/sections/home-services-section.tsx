"use client"

import { useServices } from "@/lib/hooks/use-services"
import { Button } from "@/components/ui/button"
import { ServiceCatalog } from "@/components/service-catalog"
import Link from "next/link"

function normalize(value: string | null | undefined) {
  return (value || "").toLowerCase()
}

function getServiceBadge(name: string, category: string | null) {
  const haystack = `${normalize(name)} ${normalize(category)}`

  if (haystack.includes("thai") || haystack.includes("thaï")) return "Nuad de Thaïlande"
  if (haystack.includes("huile") || haystack.includes("oil")) return "Huile"
  if (haystack.includes("pied") || haystack.includes("planta")) return "Foot massage"
  if (haystack.includes("duo")) return "Massage duo"
  if (haystack.includes("sport")) return "Récupération"
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
    return "Pressions, étirements et mobilisations inspirés des rituels de Thaïlande pour libérer le corps en profondeur."
  }

  if (haystack.includes("huile") || haystack.includes("oil")) {
    return "Un rituel à l'huile aux gestes lents et enveloppants, idéal pour apaiser les tensions diffuses."
  }

  if (haystack.includes("pied") || haystack.includes("planta")) {
    return "Un travail précis des pieds et des mollets, idéal lorsque les jambes sont lourdes ou très sollicitées."
  }

  if (haystack.includes("duo")) {
    return "Deux tables, le même tempo de soin, pour partager un véritable moment de relâchement."
  }

  if (haystack.includes("sport")) {
    return "Un travail ciblé, plus soutenu, pour accompagner la récupération et délier les tensions musculaires."
  }

  if (haystack.includes("pierre")) {
    return "La chaleur prolonge le geste, détend les tissus et donne au soin une profondeur plus fondue."
  }

  return "Un rituel mesuré, entre pressions et relâchement, pour rendre au corps sa souplesse."
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
          <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">Une carte courte, des mains sûres</h2>
        </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border border-primary/10 p-4 animate-pulse">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
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
      <section id="services" className="relative overflow-hidden py-16 sm:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,171,89,0.12),transparent_34%),linear-gradient(180deg,rgba(33,26,20,0.34)_0%,rgba(10,9,8,0)_100%)]" />
      <div className="relative max-w-7xl mx-auto px-4">
        <div className="mb-10 text-center sm:mb-16">
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos massages</span>
          <h2 className="mt-2 mb-3 text-3xl font-serif font-bold sm:mb-4 sm:text-4xl md:text-5xl">Des rituels pensés pour chaque besoin</h2>
          <p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground sm:max-w-2xl sm:text-base">
            Une carte sobre, portée par des gestes inspirés de la Thaïlande, pour apaiser, relâcher ou travailler plus en profondeur.
          </p>
        </div>
        <div className="mx-auto max-w-4xl">
          <ServiceCatalog
            services={(uniqueServices || []).slice(0, 8).map((service) => ({
              ...service,
              description: getServiceDescription(service.name, service.category, service.description),
            }))}
            selectable={false}
            compact
            getBadge={(service) => getServiceBadge(service.name, service.category)}
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" className="border-primary/25 bg-transparent">
              <Link href="/nos-prestations">Voir toutes les prestations</Link>
            </Button>
            <Button asChild>
              <Link href="/book">Réserver</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
