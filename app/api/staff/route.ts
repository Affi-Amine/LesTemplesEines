import { createAdminClient } from "@/lib/supabase/admin"
import { hashPassword } from "@/lib/auth/password"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const StaffSchema = z.object({
  salon_id: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(["therapist", "assistant", "manager", "admin", "receptionist"]),
  photo_url: z.string().optional(),
  specialties: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const salonIdOrSlug = request.nextUrl.searchParams.get("salon_id")
    const role = request.nextUrl.searchParams.get("role")
    const isActive = request.nextUrl.searchParams.get("is_active")

    const supabase = await createAdminClient()

    let query = supabase
      .from("staff")
      .select("id, salon_id, email, first_name, last_name, phone, role, photo_url, specialties, is_active, created_at, updated_at")

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
    
    if (role) query = query.eq("role", role)
    if (isActive !== null) query = query.eq("is_active", isActive === "true")

    const { data: staff, error } = await query

    if (error) throw error

    return NextResponse.json(staff)
  } catch (error) {
    console.error("[v0] Get staff error:", error)
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const staffData = StaffSchema.parse(body)

    const supabase = await createAdminClient()

    // Check if email already exists
    const { data: existing } = await supabase.from("staff").select("id").eq("email", staffData.email).single()

    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }

    // Hash password
    const passwordHash = await hashPassword(staffData.password)

    // Create staff member
    const { data: staff, error } = await supabase
      .from("staff")
      .insert([
        {
          salon_id: staffData.salon_id,
          email: staffData.email,
          password_hash: passwordHash,
          first_name: staffData.first_name,
          last_name: staffData.last_name,
          phone: staffData.phone,
          role: staffData.role,
          photo_url: staffData.photo_url,
          specialties: staffData.specialties || [],
        },
      ])
      .select("id, salon_id, email, first_name, last_name, phone, role, photo_url, specialties, is_active, created_at, updated_at")
      .single()

    if (error) throw error

    return NextResponse.json(staff, { status: 201 })
  } catch (error) {
    console.error("[v0] Create staff error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 })
  }
}
