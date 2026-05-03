import { Suspense } from "react"
import { BookingFlow } from "@/components/booking-flow"
import { Footer } from "@/components/footer"

export default function BookPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="px-4 pb-10 pt-5 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 text-left sm:mb-8 sm:text-center">
            <span className="mb-3 inline-flex rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Réservation
            </span>
            <h1 className="mb-2 text-2xl font-serif font-semibold leading-tight sm:text-3xl sm:font-bold">Réservez votre massage</h1>
            <p className="max-w-lg text-sm leading-6 text-muted-foreground sm:mx-auto sm:text-base">
              Choisissez tranquillement votre temple, votre soin et votre créneau.
            </p>
          </div>
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Chargement...</div>}>
            <BookingFlow />
          </Suspense>
        </div>
      </div>
      <Footer />
    </main>
  )
}
