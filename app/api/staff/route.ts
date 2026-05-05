import { createAdminClient } from "@/lib/supabase/admin"
import { hashPassword } from "@/lib/auth/password"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { resolveSalonGroup } from "@/lib/salons/resolve"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const StaffSchema = z.object({
  salon_id: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  gender: z.enum(["male", "female"]).nullable().optional(),
  phone: z.string().optional(),
  role: z.enum(["therapist", "assistant", "manager", "admin", "receptionist"]),
  photo_url: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  allowed_service_ids: z.array(z.string().uuid()).optional(),
  is_active: z.boolean().optional(),
})

function mapStaff(staff: any) {
  return {
    ...staff,
    allowed_service_ids: staff.staff_services?.map((relation: any) => relation.service_id) || [],
  }
}

export async function GET(request: NextRequest) {
  try {
    const salonIdOrSlug = request.nextUrl.searchParams.get("salon_id")
    const role = request.nextUrl.searchParams.get("role")
    const isActive = request.nextUrl.searchParams.get("is_active")

    const supabase = await createAdminClient()
    let targetSalonIds: string[] = []

    let query = supabase
      .from("staff")
      .select(`
        id,
        salon_id,
        email,
        first_name,
        last_name,
        gender,
        phone,
        role,
        photo_url,
        specialties,
        is_active,
        created_at,
        updated_at,
        staff_services!left(service_id)
      `)

    if (salonIdOrSlug) {
      const salonGroup = await resolveSalonGroup(supabase, salonIdOrSlug)
      if (!salonGroup) {
        return NextResponse.json({ error: "Salon not found" }, { status: 404 })
      }
      targetSalonIds = salonGroup.salonIds
    }
    
    if (role) query = query.eq("role", role)
    if (isActive !== null) query = query.eq("is_active", isActive === "true")

    const { data: staff, error } = await query

    if (error) throw error

    let filteredStaff = staff || []

    if (targetSalonIds.length > 0) {
      const { data: salonServices, error: salonServicesError } = await supabase
        .from("service_salons")
        .select("service_id")
        .in("salon_id", targetSalonIds)

      if (salonServicesError) throw salonServicesError

      const salonIdSet = new Set(targetSalonIds)
      const salonServiceIds = new Set((salonServices || []).map((relation) => relation.service_id))
      filteredStaff = filteredStaff.filter((member) => {
        if (salonIdSet.has(member.salon_id)) {
          return true
        }

        return member.staff_services?.some((relation: any) => salonServiceIds.has(relation.service_id))
      })
    }

    return NextResponse.json(
      filteredStaff
        .map(mapStaff)
        .sort((a, b) => {
          const aName = `${a.first_name || ""} ${a.last_name || ""}`.trim()
          const bName = `${b.first_name || ""} ${b.last_name || ""}`.trim()
          return aName.localeCompare(bName, "fr")
        })
    )
  } catch (error) {
    console.error("[v0] Get staff error:", error)
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager"])
    if ("response" in auth) {
      return auth.response
    }

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
          gender: staffData.gender ?? null,
          phone: staffData.phone,
          role: staffData.role,
          photo_url: staffData.photo_url,
          specialties: staffData.specialties || [],
          is_active: staffData.is_active ?? true,
        },
      ])
      .select(`
        id,
        salon_id,
        email,
        first_name,
        last_name,
        gender,
        phone,
        role,
        photo_url,
        specialties,
        is_active,
        created_at,
        updated_at
      `)
      .single()

    if (error) throw error

    if (staffData.allowed_service_ids && staffData.allowed_service_ids.length > 0) {
      const { error: relationError } = await supabase
        .from("staff_services")
        .insert(
          staffData.allowed_service_ids.map((serviceId) => ({
            staff_id: staff.id,
            service_id: serviceId,
          }))
        )

      if (relationError) throw relationError
    }

    const { data: fullStaff, error: fullStaffError } = await supabase
      .from("staff")
      .select(`
        id,
        salon_id,
        email,
        first_name,
        last_name,
        gender,
        phone,
        role,
        photo_url,
        specialties,
        is_active,
        created_at,
        updated_at,
        staff_services!left(service_id)
      `)
      .eq("id", staff.id)
      .single()

    if (fullStaffError) throw fullStaffError

    return NextResponse.json(mapStaff(fullStaff), { status: 201 })
  } catch (error) {
    console.error("[v0] Create staff error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 })
  }
}
