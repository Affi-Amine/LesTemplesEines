"use client"

import { Card } from "@/components/ui/card"
import Image from "next/image"
import { useServices } from "@/lib/hooks/use-services"

export function HomeServicesSection() {
  // Fetch all services (no salon filter for homepage)
  const { data: services, isLoading, error } = useServices(undefined, true)

  if (isLoading) {
    return (
      <section id="services" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16 text-center">
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos Services</span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mt-2 mb-4">Soins Thérapeutiques</h2>
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
          {uniqueServices?.slice(0, 5).map((service) => (
            <Card
              key={service.id}
              className="p-6 text-center hover:shadow-lg transition-all duration-300 group border-primary/10 hover:border-primary/30 cursor-pointer"
            >
              <div className="relative h-40 mb-4 bg-muted rounded-2xl overflow-hidden">
                <Image
                  src={service.image_url || "/placeholder.svg?height=160&width=200"}
                  alt={service.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg?height=160&width=200"
                  }}
                />
              </div>
              <h3 className="font-semibold mb-2 text-foreground">{service.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">{service.duration_minutes} minutes</p>
              <p className="text-xl font-bold text-primary">{(service.price_cents / 100).toFixed(2)}€</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
