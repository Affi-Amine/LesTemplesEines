import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ServiceCatalog } from "@/components/service-catalog"

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
  return (
    <section className="py-16 bg-gradient-to-b from-muted/20 to-background sm:py-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-10 text-center sm:mb-12">
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Nos Prestations</span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mt-3 mb-4">
            Une carte claire, des soins précis
          </h2>
          <p className="text-base leading-8 text-muted-foreground max-w-2xl mx-auto">
            Les prestations sont organisées par familles pour comparer rapidement la durée, le prix et l&apos;intention du soin.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <ServiceCatalog services={services} selectable={false} compact={false} />
          <div className="mt-6 flex justify-center">
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/book">Choisir une prestation</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
