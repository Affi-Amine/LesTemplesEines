import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const ServiceSchema = z.object({
  salon_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  duration_minutes: z.number().min(1),
  price_cents: z.number().min(0),
  category: z.string().optional(),
  image_url: z.string().optional(),
  required_staff_count: z.number().min(1).default(1),
})

export async function GET(request: NextRequest) {
  try {
    const salonIdOrSlug = request.nextUrl.searchParams.get("salon_id")

    const supabase = await createAdminClient()

    let query = supabase.from("services").select("*").eq("is_active", true)

    if (salonIdOrSlug) {
      // Check if it's a UUID or a slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonIdOrSlug)
      
      if (isUUID) {
        // It's already a UUID, use it directly
        query = query.eq("salon_id", salonIdOrSlug)
      } else {
        // It's a slug, need to convert to UUID first
        const { data: salon, error: salonError } = await supabase
          .from("salons")
          .select("id")
          .eq("slug", salonIdOrSlug)
          .single()

        if (salonError || !salon) {
          return NextResponse.json({ error: "Salon not found" }, { status: 404 })
        }

        query = query.eq("salon_id", salon.id)
      }
    }

    const { data: services, error } = await query

    if (error) throw error

    return NextResponse.json(services)
  } catch (error) {
    console.error("[v0] Get services error:", error)
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const serviceData = ServiceSchema.parse(body)

    const supabase = await createAdminClient()

    const { data: service, error } = await supabase.from("services").insert([serviceData]).select().single()

    if (error) throw error

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error("[v0] Create service error:", error)
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 })
  }
}
