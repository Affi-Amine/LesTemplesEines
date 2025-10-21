import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const SalonSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  siret: z.string().optional(),
  opening_hours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })).optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: salons, error } = await supabase.from("salons").select("*").eq("is_active", true)

    if (error) throw error

    return NextResponse.json(salons)
  } catch (error) {
    console.error("[v0] Get salons error:", error)
    return NextResponse.json({ error: "Failed to fetch salons" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const salonData = SalonSchema.parse(body)

    const supabase = await createClient()

    const { data: salon, error } = await supabase.from("salons").insert([salonData]).select().single()

    if (error) throw error

    return NextResponse.json(salon, { status: 201 })
  } catch (error) {
    console.error("[v0] Create salon error:", error)
    return NextResponse.json({ error: "Failed to create salon" }, { status: 500 })
  }
}
