import { MapPin, Phone, Clock, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Icon } from "@iconify/react"

interface SalonHeaderProps {
  name: string
  city: string
  address: string
  phone: string
  image: string
  slug: string
  hours: Record<string, { open: string; close: string }>
}

export function SalonHeader({ name, city, address, phone, image, slug, hours }: SalonHeaderProps) {
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
      {/* Enhanced Hero Image with Parallax Effect */}
      <div className="relative h-[450px] md:h-[550px] w-full bg-muted overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover scale-105 hover:scale-100 transition-transform duration-700"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10">
            <Icon icon="solar:buildings-3-bold" className="w-32 h-32 text-primary/30" />
          </div>
        )}
        {/* Enhanced Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Hero Content Overlay */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto px-4 pb-12 w-full">
            <div className="text-white space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="secondary" className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Premium Spa Experience
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
              <h1 className="text-5xl md:text-7xl font-serif font-bold drop-shadow-2xl">
                {name}
              </h1>
              <p className="text-xl md:text-2xl font-light opacity-95 drop-shadow-lg">
                Votre Sanctuaire de Bien-être à {city}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Info Bar */}
      <div className="bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Contact Info Grid */}
            <div className="grid md:grid-cols-3 gap-6 flex-1">
              <div className="flex items-start gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Adresse</p>
                  <p className="text-sm font-medium">{address}</p>
                  <p className="text-xs text-muted-foreground">{city}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 group">
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
                <div className="flex items-start gap-3 group">
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
            <Link href={`/book/${slug}`} className="lg:flex-shrink-0">
              <Button
                size="lg"
                className="w-full lg:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer group"
              >
                Réserver Maintenant
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
