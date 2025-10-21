import { BookingFlow } from "@/components/booking-flow"
import { Footer } from "@/components/footer"
import { salons } from "@/lib/mock-data"

interface SalonBookingPageProps {
  params: Promise<{
    salon: string
  }>
}

export default async function SalonBookingPage({ params }: SalonBookingPageProps) {
  const { salon: salonSlug } = await params
  const salon = salons.find((s) => s.slug === salonSlug)

  if (!salon) {
    return (
      <main className="min-h-screen bg-background py-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Salon not found</h1>
          <p className="text-muted-foreground">The salon you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Book at {salon.name}</h1>
            <p className="text-muted-foreground">Complete your reservation in 5 simple steps</p>
          </div>
          <BookingFlow initialSalon={salon.id} />
        </div>
      </div>
      <Footer />
    </main>
  )
}
