import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ServiceCatalog } from "@/components/service-catalog"

interface Service {
  id: string
  name: string
  description: string
  duration: number
  price: number
  category: string | null
  image: string
}

interface SalonServicesProps {
  services: Service[]
}

export function SalonServices({ services }: SalonServicesProps) {
  return (
    <section className="py-10 bg-gradient-to-b from-muted/12 to-background sm:py-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6 text-left sm:mb-12 sm:text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-sm sm:tracking-widest">Nos prestations</span>
          <h2 className="mt-2 mb-2 text-2xl font-serif font-semibold leading-tight sm:mt-3 sm:mb-4 sm:text-4xl sm:font-bold md:text-5xl">
            Une carte claire, des soins précis
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:mx-auto sm:text-base sm:leading-8">
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
