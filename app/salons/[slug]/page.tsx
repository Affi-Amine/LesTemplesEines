import { SalonHeader } from "@/components/salon-header"
import { SalonServices } from "@/components/salon-services"
import { SalonTeam } from "@/components/salon-team"
import { SalonHours } from "@/components/salon-hours"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface SalonPageProps {
  params: Promise<{
    slug: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function SalonPage({ params }: SalonPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  console.log(`[SalonPage] Fetching salon: ${slug}`)

  // Fetch all active salons and find by slug (case-insensitive, trimmed to handle database inconsistencies)
  const { data: salons } = await supabase
    .from("salons")
    .select("*")
    .eq("is_active", true)

  // Find salon with matching slug (case-insensitive, trimmed)
  const salon = salons?.find(
    (s) => s.slug?.trim().toLowerCase() === slug.trim().toLowerCase()
  )
  
  if (salon) {
     console.log(`[SalonPage] Salon found: ${salon.name}, Image URL: ${salon.image_url}`)
  } else {
     console.log(`[SalonPage] Salon not found for slug: ${slug}`)
  }

  if (!salon) {
    return (
      <main className="min-h-screen bg-background py-8">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Salon introuvable</h1>
          <p className="text-muted-foreground mb-6">Le salon que vous recherchez n&apos;existe pas.</p>
          <Button asChild>
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </main>
    )
  }

  // Fetch services for this salon
  const { data: services } = await supabase
    .from("services")
    .select(`
      *,
      service_salons!inner(
        salon_id
      )
    `)
    .eq("service_salons.salon_id", salon.id)
    .eq("is_active", true)
    .order("category")

  // Fetch staff for this salon
  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("salon_id", salon.id)
    .eq("is_active", true)
    .order("first_name")

  // Transform staff data to match the component's expected format
  const salonEmployees = (staff || []).map((member: any) => ({
    id: member.id,
    name: `${member.first_name} ${member.last_name}`,
    role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
    photo: member.photo_url || "/placeholder.svg?height=192&width=300&query=professional therapist",
    specialties: member.specialties || [],
  }))

  // Transform services data to match the component's expected format
  const transformedServices = (services || []).map((service: any) => ({
    id: service.id,
    name: service.name,
    description: service.description || "",
    duration: service.duration_minutes,
    price: service.price_cents / 100,
    category: service.category || "Services",
    image: service.image_url || "/placeholder.svg?height=160&width=300&query=massage therapy",
  }))

  // Create service names mapping
  const serviceNames = Object.fromEntries((services || []).map((s: any) => [s.id, s.name]))

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <SalonHeader {...salon} image={salon.image_url} images={salon.images || []} hours={salon.opening_hours} autoplay={true} />
      <SalonServices services={transformedServices} />
      <SalonTeam employees={salonEmployees} serviceNames={serviceNames} />
      <SalonHours hours={salon.opening_hours} />

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="temple-frame temple-panel rounded-[1.75rem] px-8 py-12">
          <h2 className="text-4xl font-serif font-bold mb-4 text-primary">Prenez le temps de choisir votre moment</h2>
          <p className="text-lg mb-8 text-muted-foreground">Reservez votre experience de massage ideale dans ce salon des aujourd'hui.</p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_12px_30px_rgba(214,171,89,0.2)]">
            <Link href={`/book/${salon.slug}`}>Réserver un rendez-vous</Link>
          </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
