import { SalonHeader } from "@/components/salon-header"
import { SalonServices } from "@/components/salon-services"
import { SalonTeam } from "@/components/salon-team"
import { SalonHours } from "@/components/salon-hours"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface SalonPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function SalonPage({ params }: SalonPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch salon by slug
  const { data: salon } = await supabase
    .from("salons")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single()

  if (!salon) {
    return (
      <main className="min-h-screen bg-background py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Salon introuvable</h1>
          <p className="text-muted-foreground mb-6">Le salon que vous recherchez n&apos;existe pas.</p>
          <Link href="/">
            <Button>Retour à l&apos;accueil</Button>
          </Link>
        </div>
      </main>
    )
  }

  // Fetch services for this salon
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("salon_id", salon.id)
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
      <SalonHeader {...salon} hours={salon.opening_hours} />
      <SalonServices services={transformedServices} />
      <SalonTeam employees={salonEmployees} serviceNames={serviceNames} />
      <SalonHours hours={salon.opening_hours} />

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Prêt à vous évader ?</h2>
          <p className="text-lg mb-8 opacity-90">Réservez votre expérience de massage idéale dès aujourd&apos;hui</p>
          <Link href={`/book/${salon.slug}`}>
            <Button size="lg" variant="secondary">
              Réserver un rendez-vous
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
