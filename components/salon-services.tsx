import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@iconify/react"
import { Clock, Euro } from "lucide-react"

interface Service {
  id: string
  name: string
  description: string
  duration: number
  price: number
  category: string
  image: string
}

interface SalonServicesProps {
  services: Service[]
}

export function SalonServices({ services }: SalonServicesProps) {
  const categories = Array.from(new Set(services.map((s) => s.category)))

  return (
    <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
      <div className="max-w-7xl mx-auto px-4">
        {/* Enhanced Section Header */}
        <div className="mb-16 text-center">
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos Prestations</span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mt-3 mb-4">
            Services & Soins
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Découvrez notre gamme complète de soins thérapeutiques et relaxants,
            conçus pour votre bien-être absolu
          </p>
        </div>

        {categories.map((category, categoryIndex) => (
          <div key={category} className="mb-16 last:mb-0">
            {/* Category Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent flex-1" />
              <h3 className="text-2xl font-serif font-semibold text-primary px-4">
                {category}
              </h3>
              <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent flex-1" />
            </div>

            {/* Services Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services
                .filter((s) => s.category === category)
                .map((service) => (
                  <Card
                    key={service.id}
                    className="group overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-0 bg-card shadow-md"
                  >
                    {/* Service Image with Overlay */}
                    <div className="relative h-48 bg-muted overflow-hidden">
                      {service.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={service.image}
                          alt={service.name}
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 group-hover:from-primary/30 group-hover:via-primary/15 group-hover:to-accent/15 transition-colors duration-500">
                          <Icon icon="solar:spa-bold" className="w-16 h-16 text-primary/40" />
                        </div>
                      )}
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Price Badge Overlay */}
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-white/95 backdrop-blur-sm text-primary border-0 shadow-lg px-3 py-1 font-bold">
                          <Euro className="w-3 h-3 mr-1" />
                          {service.price}
                        </Badge>
                      </div>
                    </div>

                    {/* Service Details */}
                    <div className="p-5">
                      <h4 className="font-serif font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                        {service.name}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                        {service.description}
                      </p>

                      {/* Duration Badge */}
                      <div className="flex items-center gap-2 pt-3 border-t">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium">{service.duration} minutes</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
