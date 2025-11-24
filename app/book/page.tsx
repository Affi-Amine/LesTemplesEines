import { BookingFlow } from "@/components/booking-flow"
import { Footer } from "@/components/footer"

export default function BookPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Réservez votre massage</h1>
            <p className="text-muted-foreground">Terminez votre réservation en 5 étapes simples</p>
          </div>
          <BookingFlow />
        </div>
      </div>
      <Footer />
    </main>
  )
}
