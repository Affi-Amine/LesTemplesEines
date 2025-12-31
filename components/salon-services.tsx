import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@iconify/react"

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
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-2">Our Services</h2>
          <p className="text-muted-foreground">Discover our range of therapeutic and relaxation treatments</p>
        </div>

        {categories.map((category) => (
          <div key={category} className="mb-12">
            <h3 className="text-xl font-semibold mb-6 text-primary">{category}</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services
                .filter((s) => s.category === category)
                .map((service) => (
                  <Card key={service.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative h-40 bg-muted">
                      {service.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={service.image}
                          alt={service.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-primary/5">
                          <Icon icon="solar:spa-bold" className="w-12 h-12 text-primary/30" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold mb-2">{service.name}</h4>
                      <p className="text-sm text-muted-foreground mb-4">{service.description}</p>
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <Badge variant="secondary">{service.duration} min</Badge>
                        </div>
                        <span className="text-lg font-bold text-primary">{service.price}€</span>
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
