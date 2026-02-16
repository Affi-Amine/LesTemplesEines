import { BookingFlow } from "@/components/booking-flow"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/server"

interface SalonBookingPageProps {
  params: Promise<{
    salon: string
  }>
}

export default async function SalonBookingPage({ params }: SalonBookingPageProps) {
  const { salon: salonSlug } = await params

  // Fetch salon from database by slug
  // Use ilike for case-insensitive match and trim to handle trailing spaces in database
  const supabase = await createClient()
  const { data: salons } = await supabase
    .from("salons")
    .select("*")
    .eq("is_active", true)

  // Find salon with matching slug (case-insensitive, trimmed)
  const salon = salons?.find(
    (s) => s.slug?.trim().toLowerCase() === salonSlug.trim().toLowerCase()
  )

  if (!salon) {
    return (
      <main className="min-h-screen bg-background py-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Salon introuvable</h1>
          <p className="text-muted-foreground">Le salon que vous recherchez n&apos;existe pas.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Réserver chez {salon.name}</h1>
            <p className="text-muted-foreground">Terminez votre réservation en 5 étapes simples</p>
          </div>
          <BookingFlow initialSalon={salon.id} />
        </div>
      </div>
      <Footer />
    </main>
  )
}
