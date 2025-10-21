import { SalonHeader } from "@/components/salon-header"
import { SalonServices } from "@/components/salon-services"
import { SalonTeam } from "@/components/salon-team"
import { SalonHours } from "@/components/salon-hours"
import { Footer } from "@/components/footer"
import { salons, services, employees } from "@/lib/mock-data"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface SalonPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function SalonPage({ params }: SalonPageProps) {
  const { slug } = await params
  const salon = salons.find((s) => s.slug === slug)

  if (!salon) {
    return (
      <main className="min-h-screen bg-background py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Salon not found</h1>
          <p className="text-muted-foreground mb-6">The salon you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </main>
    )
  }

  const salonEmployees = employees.filter((e) => e.salonId === salon.id)
  const serviceNames = Object.fromEntries(services.map((s) => [s.id, s.name]))

  return (
    <main className="min-h-screen bg-background">
      <SalonHeader {...salon} />
      <SalonServices services={services} />
      <SalonTeam employees={salonEmployees} serviceNames={serviceNames} />
      <SalonHours hours={salon.hours} />

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Escape?</h2>
          <p className="text-lg mb-8 opacity-90">Book your perfect massage experience today</p>
          <Link href={`/book/${salon.slug}`}>
            <Button size="lg" variant="secondary">
              Book Your Appointment
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
