"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { useTranslations } from "@/lib/i18n/use-translations"
import { CheckCircle, Calendar, Clock, MapPin, User, Phone, Mail, ArrowLeft, Plus } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { fr } from "date-fns/locale"
import Link from "next/link"

function BookingSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslations()
  const [mounted, setMounted] = useState(false)

  // Get booking details from URL params or localStorage
  const [bookingDetails, setBookingDetails] = useState<any>(null)

  useEffect(() => {
    setMounted(true)
    
    // Try to get booking details from localStorage (set by booking flow)
    const storedBooking = localStorage.getItem("lastBooking")
    if (storedBooking) {
      try {
        setBookingDetails(JSON.parse(storedBooking))
      } catch (error) {
        console.error("Error parsing booking details:", error)
      }
    }
  }, [])

  if (!mounted) {
    return null // Prevent hydration mismatch
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Success Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-green-600 mb-4">
              {t("booking.success_title")}
            </h1>
            <p className="text-xl text-muted-foreground mb-2">
              {t("booking.success_subtitle")}
            </p>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t("booking.success_message")}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Booking Details */}
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center">
                <Calendar className="w-6 h-6 mr-3 text-primary" />
                {t("booking.appointment_details")}
              </h2>
              
              {bookingDetails ? (
                <div className="space-y-4">
                  {bookingDetails.reference && (
                    <div className="flex items-center justify-between py-3 border-b">
                      <span className="font-medium">{t("booking.booking_reference")}</span>
                      <span className="text-primary font-mono">{bookingDetails.reference}</span>
                    </div>
                  )}
                  
                  {bookingDetails.salon && (
                    <div className="flex items-start py-3 border-b">
                      <MapPin className="w-5 h-5 mr-3 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-medium">{bookingDetails.salon.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {bookingDetails.salon.address}, {bookingDetails.salon.city}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {bookingDetails.service && (
                    <div className="flex items-start py-3 border-b">
                      <div className="w-5 h-5 mr-3 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      </div>
                      <div>
                        <div className="font-medium">{bookingDetails.service.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {bookingDetails.service.duration_minutes} min • €{(bookingDetails.service.price_cents / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {bookingDetails.staff && (
                    <div className="flex items-center py-3 border-b">
                      <User className="w-5 h-5 mr-3 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {bookingDetails.staff.first_name} {bookingDetails.staff.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {bookingDetails.staff.role}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {bookingDetails.start_time && (
                    <div className="flex items-center py-3 border-b">
                      <Clock className="w-5 h-5 mr-3 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {formatInTimeZone(bookingDetails.start_time, "Europe/Paris", "EEEE d MMMM yyyy", { locale: fr })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatInTimeZone(bookingDetails.start_time, "Europe/Paris", "HH:mm")}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {bookingDetails.client && (
                    <>
                      <div className="flex items-center py-3 border-b">
                        <User className="w-5 h-5 mr-3 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {bookingDetails.client.first_name} {bookingDetails.client.last_name}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center py-3 border-b">
                        <Phone className="w-5 h-5 mr-3 text-muted-foreground" />
                        <div className="font-medium">{bookingDetails.client.phone}</div>
                      </div>
                      
                      {bookingDetails.client.email && (
                        <div className="flex items-center py-3">
                          <Mail className="w-5 h-5 mr-3 text-muted-foreground" />
                          <div className="font-medium">{bookingDetails.client.email}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Détails de la réservation non disponibles</p>
                  <p className="text-sm mt-2">Vérifiez votre SMS de confirmation</p>
                </div>
              )}
            </Card>

            {/* What's Next */}
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">
                {t("booking.what_next")}
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-4 mt-1">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{t("booking.arrive_early")}</h3>
                    <p className="text-sm text-muted-foreground">
                      Cela nous permettra de vous accueillir dans les meilleures conditions
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-4 mt-1">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{t("booking.bring_id")}</h3>
                    <p className="text-sm text-muted-foreground">
                      Nécessaire pour votre première visite
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-4 mt-1">
                    <div className="w-4 h-4 bg-primary/20 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{t("booking.comfortable_clothes")}</h3>
                    <p className="text-sm text-muted-foreground">
                      Pour votre confort pendant le massage
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="outline" size="lg" className="min-w-[200px]">
              <Link href="/" className="flex items-center">
                <ArrowLeft className="w-5 h-5 mr-2" />
                {t("booking.return_home")}
              </Link>
            </Button>
            
            <Button asChild size="lg" className="min-w-[200px]">
              <Link href="/book" className="flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                {t("booking.book_another")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
      
      <Footer />
    </main>
  )
}

function LoadingFallback() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <CheckCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-400 mb-4">Loading...</h1>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BookingSuccessContent />
    </Suspense>
  )
}