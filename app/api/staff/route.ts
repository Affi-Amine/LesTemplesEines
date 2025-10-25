import { createClient } from "@/lib/supabase/server"
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
  role: z.enum(["therapist", "assistant", "manager", "admin"]),
  photo_url: z.string().optional(),
  specialties: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const salonId = request.nextUrl.searchParams.get("salon_id")
    const role = request.nextUrl.searchParams.get("role")
    const isActive = request.nextUrl.searchParams.get("is_active")

    const supabase = await createClient()

    let query = supabase.from("staff").select("id, salon_id, email, first_name, last_name, phone, role, photo_url, specialties, is_active, created_at, updated_at")

    if (salonId) query = query.eq("salon_id", salonId)
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

    const supabase = await createClient()

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
