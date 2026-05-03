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
      <div className="relative h-[390px] w-full overflow-hidden bg-muted sm:h-[560px] md:h-[620px]">
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
          <div className="max-w-7xl mx-auto px-4 pb-6 sm:pb-12 md:pb-14 w-full pointer-events-auto">
            <div className="max-w-3xl space-y-3 text-white sm:space-y-5">
              <div className="mb-1 flex flex-wrap items-center gap-2 sm:mb-2 sm:gap-3">
                <Badge variant="secondary" className="h-7 bg-background/38 px-2.5 text-[11px] text-primary backdrop-blur-sm border-primary/25 hover:bg-background/50 sm:h-auto sm:px-3 sm:text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Maison de massage
                </Badge>
                {todayHours && (
                  <Badge
                    variant="secondary"
                    className={`h-7 px-2.5 text-[11px] backdrop-blur-sm border sm:h-auto sm:px-3 sm:text-xs ${
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
              <h1 className="text-3xl font-serif font-semibold leading-tight drop-shadow-2xl sm:text-5xl sm:font-bold md:text-7xl md:leading-[0.95]">
                {name}
              </h1>
              <p className="max-w-xl text-sm font-light leading-6 opacity-95 drop-shadow-lg sm:text-lg md:text-2xl">
                Une adresse confidentielle à {city}, dédiée au calme, à la précision du geste et au temps long.
              </p>
              <div className="temple-divider max-w-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Info Bar */}
      <div className="bg-card border-b border-primary/15 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3.5 md:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            {/* Contact Info Grid */}
            <div className="grid flex-1 gap-2.5 md:grid-cols-3 md:gap-6">
              <div className="flex items-start gap-2.5 group temple-panel rounded-xl p-3 sm:rounded-2xl sm:p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20 sm:h-10 sm:w-10 sm:rounded-xl">
                  <MapPin className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:mb-1 sm:text-xs">Adresse</p>
                  <p className="text-xs font-medium leading-5 sm:text-sm">{address}</p>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">{city}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 group temple-panel rounded-xl p-3 sm:rounded-2xl sm:p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20 sm:h-10 sm:w-10 sm:rounded-xl">
                  <Phone className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:mb-1 sm:text-xs">Téléphone</p>
                  <a
                    href={`tel:${phone}`}
                    className="block text-xs font-medium transition-colors hover:text-primary sm:text-sm"
                  >
                    {phone}
                  </a>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">Appeler maintenant</p>
                </div>
              </div>

              {todayHours && (
                <div className="flex items-start gap-2.5 group temple-panel rounded-xl p-3 sm:rounded-2xl sm:p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20 sm:h-10 sm:w-10 sm:rounded-xl">
                    <Clock className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:mb-1 sm:text-xs">Aujourd&apos;hui</p>
                    <p className="text-xs font-medium sm:text-sm">
                      {todayHours.open} - {todayHours.close}
                    </p>
                    <p className="text-[11px] text-muted-foreground sm:text-xs">
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
              className="h-10 w-full text-sm lg:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer group lg:flex-shrink-0 sm:h-11"
            >
              <Link href={`/book/${slug}`}>
                Réserver maintenant
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
