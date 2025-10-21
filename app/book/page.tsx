import { BookingFlow } from "@/components/booking-flow"
import { Footer } from "@/components/footer"

export default function BookPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Book Your Massage</h1>
            <p className="text-muted-foreground">Complete your reservation in 5 simple steps</p>
          </div>
          <BookingFlow />
        </div>
      </div>
      <Footer />
    </main>
  )
}
