import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const SalonSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  siret: z.string().optional(),
  image_url: z.string().optional(),
  images: z.array(z.string()).optional(), // Array of image URLs for carousel
  opening_hours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true"

    if (includeInactive) {
      const auth = requireStaffAuth(request)
      if ("response" in auth) {
        return auth.response
      }
    }

    const supabase = await createAdminClient()
    let query = supabase.from("salons").select("*")

    if (!includeInactive) {
      query = query.eq("is_active", true)
    }

    const { data: salons, error } = await query.order("name", { ascending: true })

    if (error) throw error

    return NextResponse.json(salons)
  } catch (error) {
    console.error("[v0] Get salons error:", error)
    return NextResponse.json({ error: "Failed to fetch salons" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin"])
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json()
    const salonData = SalonSchema.parse(body)

    const supabase = await createAdminClient()

    const { data: salon, error } = await supabase.from("salons").insert([salonData]).select().single()

    if (error) throw error

    return NextResponse.json(salon, { status: 201 })
  } catch (error) {
    console.error("[v0] Create salon error:", error)
    return NextResponse.json({ error: "Failed to create salon" }, { status: 500 })
  }
}
