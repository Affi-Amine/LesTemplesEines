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
})

export async function GET(request: NextRequest) {
  try {
    const salonId = request.nextUrl.searchParams.get("salon_id")

    const supabase = await createAdminClient()

    let query = supabase.from("services").select("*").eq("is_active", true)

    if (salonId) {
      query = query.eq("salon_id", salonId)
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
