import { MapPin, Phone, Clock, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Icon } from "@iconify/react"
import { SalonCarousel } from "@/components/salon-carousel"

interface SalonHeaderProps {
  name: string
  city: string
  address: string
  phone: string
  image: string
  images?: string[] // Array of images for carousel
  slug: string
  hours: Record<string, { open: string; close: string }>
  autoplay?: boolean // Whether carousel auto-plays (default: false)
}

export function SalonHeader({ name, city, address, phone, image, images = [], slug, hours, autoplay = false }: SalonHeaderProps) {
  // Use images array if available, otherwise fall back to single image
  const carouselImages = images.length > 0 ? images : (image ? [image] : [])
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
  const todayHours = hours && hours[today as keyof typeof hours]

  // Check if currently open
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTime = currentHour * 60 + currentMinute

  let isOpen = false
  if (todayHours) {
    const [openHour, openMinute] = todayHours.open.split(':').map(Number)
    const [closeHour, closeMinute] = todayHours.close.split(':').map(Number)
    const openTime = openHour * 60 + openMinute
    const closeTime = closeHour * 60 + closeMinute
    isOpen = currentTime >= openTime && currentTime <= closeTime
  }

  return (
    <div className="w-full">
      {/* Enhanced Hero Image with Carousel */}
      <div className="relative h-[520px] w-full overflow-hidden bg-muted sm:h-[560px] md:h-[620px]">
        <SalonCarousel
          images={carouselImages}
          alt={name}
          autoplay={autoplay}
          showNavigation={true}
          showDots={true}
        />
        {/* Enhanced Gradient Overlay - pointer-events-none to allow carousel button clicks */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,10,8,0.2)_0%,rgba(11,8,6,0.18)_30%,rgba(7,6,5,0.82)_100%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(214,171,89,0.18),transparent_22%)] pointer-events-none" />

        {/* Hero Content Overlay - pointer-events-none on container, auto on interactive elements */}
        <div className="absolute inset-0 flex items-end pointer-events-none">
          <div className="max-w-7xl mx-auto px-4 pb-10 sm:pb-12 md:pb-14 w-full pointer-events-auto">
            <div className="text-white space-y-5 max-w-3xl">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <Badge variant="secondary" className="bg-background/38 backdrop-blur-sm text-primary border-primary/25 hover:bg-background/50">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Maison de massage
                </Badge>
                {todayHours && (
                  <Badge
                    variant="secondary"
                    className={`backdrop-blur-sm border ${
                      isOpen
                        ? 'bg-green-500/20 text-green-100 border-green-400/30'
                        : 'bg-red-500/20 text-red-100 border-red-400/30'
                    }`}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {isOpen ? 'Ouvert' : 'Fermé'}
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl font-serif font-bold leading-[0.95] drop-shadow-2xl sm:text-5xl md:text-7xl">
                {name}
              </h1>
              <p className="text-base font-light opacity-95 drop-shadow-lg sm:text-lg md:text-2xl">
                Une adresse confidentielle a {city}, dediee au calme, a la precision du geste et au temps long.
              </p>
              <div className="temple-divider max-w-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Info Bar */}
      <div className="bg-card border-b border-primary/15 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5 md:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Contact Info Grid */}
            <div className="grid flex-1 gap-4 md:grid-cols-3 md:gap-6">
              <div className="flex items-start gap-3 group temple-panel rounded-2xl p-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Adresse</p>
                  <p className="text-sm font-medium">{address}</p>
                  <p className="text-xs text-muted-foreground">{city}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 group temple-panel rounded-2xl p-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Téléphone</p>
                  <a
                    href={`tel:${phone}`}
                    className="text-sm font-medium hover:text-primary transition-colors block"
                  >
                    {phone}
                  </a>
                  <p className="text-xs text-muted-foreground">Appeler maintenant</p>
                </div>
              </div>

              {todayHours && (
                <div className="flex items-start gap-3 group temple-panel rounded-2xl p-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Aujourd&apos;hui</p>
                    <p className="text-sm font-medium">
                      {todayHours.open} - {todayHours.close}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isOpen ? 'Nous sommes ouverts' : 'Actuellement fermé'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced CTA Button */}
            <Button
              asChild
              size="lg"
              className="w-full lg:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer group lg:flex-shrink-0"
            >
              <Link href={`/book/${slug}`}>
                Réserver Maintenant
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
