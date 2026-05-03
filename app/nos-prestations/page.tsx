import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { ServiceCatalog } from "@/components/service-catalog"
import { getServices } from "@/lib/api/server"

export const dynamic = "force-dynamic"

export default async function NosPrestationsPage() {
  const services = await getServices()
  const uniqueServices = services.reduce((acc, service) => {
    if (!acc.some((item) => item.name === service.name)) {
      acc.push(service)
    }
    return acc
  }, [] as typeof services)

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden px-4 pb-12 pt-[5.5rem] sm:pb-16 sm:pt-28 md:pb-20 md:pt-32">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(214,171,89,0.09)_0%,rgba(214,171,89,0)_36%)]" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-5 max-w-4xl space-y-3 sm:mb-10 sm:space-y-5">
            <span className="inline-flex rounded-full border border-primary/20 bg-background/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.18em]">
              Nos prestations
            </span>
            <h1 className="max-w-4xl text-2xl font-serif font-semibold leading-tight sm:text-5xl sm:font-bold md:text-6xl md:leading-[1.04]">
              Une carte lisible, pensée pour choisir vite et juste
            </h1>
            <p className="max-w-3xl text-[0.82rem] leading-6 text-muted-foreground sm:text-base sm:leading-8 md:text-lg">
              Parcourez les soins par catégories, comparez les durées et les prix en un coup d&apos;oeil, puis réservez dans le temple de votre choix.
            </p>
          </div>

          <ServiceCatalog services={uniqueServices} selectable={false} />

          <div className="mt-5 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3">
            <Button asChild size="lg">
              <Link href="/book">Réserver une prestation</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-primary/25 bg-transparent">
              <Link href="/nos-temples">Choisir un temple</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
