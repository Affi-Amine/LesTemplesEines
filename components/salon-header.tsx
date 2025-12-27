import { MapPin, Phone, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  return (
    <div className="w-full">
      {/* Hero Image */}
      <div className="relative h-64 md:h-96 w-full bg-muted overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-primary/5">
            <Icon icon="solar:buildings-3-bold" className="w-24 h-24 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Header Info */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">{name}</h1>
              <p className="text-lg text-muted-foreground mb-4">{city} Sanctuary</p>

              {/* Contact Info */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{address}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <a href={`tel:${phone}`} className="hover:text-primary transition-colors">
                    {phone}
                  </a>
                </div>
                {todayHours && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      Today: {todayHours.open} - {todayHours.close}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CTA Button */}
            <Link href={`/book/${slug}`}>
              <Button size="lg" className="bg-primary hover:bg-primary/90 w-full md:w-auto">
                Book Now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
