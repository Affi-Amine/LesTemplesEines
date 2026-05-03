import { Suspense } from "react"
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
      <div className="px-4 pb-8 pt-4 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 text-left sm:mb-8 sm:text-center">
            <span className="mb-2.5 inline-flex rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary sm:text-[11px]">
              {salon.city}
            </span>
            <h1 className="mb-1.5 text-xl font-serif font-semibold leading-tight sm:text-3xl sm:font-bold">Réserver chez {salon.name}</h1>
            <p className="max-w-lg text-[0.82rem] leading-5 text-muted-foreground sm:mx-auto sm:text-base sm:leading-6">
              Choisissez votre soin et le créneau qui vous convient.
            </p>
          </div>
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Chargement...</div>}>
            <BookingFlow initialSalon={salon.id} />
          </Suspense>
        </div>
      </div>
      <Footer />
    </main>
  )
}
