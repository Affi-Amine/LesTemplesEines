import { createAdminClient } from "@/lib/supabase/admin"
import { hashPassword } from "@/lib/auth/password"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const UpdateStaffSchema = z.object({
  salon_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["therapist", "assistant", "manager", "admin", "receptionist"]).optional(),
  photo_url: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: staff, error } = await supabase
      .from("staff")
      .select("id, salon_id, email, first_name, last_name, phone, role, photo_url, specialties, is_active, created_at, updated_at")
      .eq("id", id)
      .single()

    if (error) throw error

    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    return NextResponse.json(staff)
  } catch (error) {
    console.error("[v0] Get staff by ID error:", error)
    return NextResponse.json({ error: "Failed to fetch staff member" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const staffData = UpdateStaffSchema.parse(body)

    const supabase = await createAdminClient()

    // Check if staff exists
    const { data: existing } = await supabase.from("staff").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    // If email is being updated, check if it's already in use
    if (staffData.email) {
      const { data: emailExists } = await supabase
        .from("staff")
        .select("id")
        .eq("email", staffData.email)
        .neq("id", id)
        .single()

      if (emailExists) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 })
      }
    }

    // Prepare update data
    const updateData: any = { ...staffData }

    // Hash password if provided
    if (staffData.password) {
      updateData.password_hash = await hashPassword(staffData.password)
      delete updateData.password
    }

    // Update staff member
    const { data: staff, error } = await supabase
      .from("staff")
      .update(updateData)
      .eq("id", id)
      .select("id, salon_id, email, first_name, last_name, phone, role, photo_url, specialties, is_active, created_at, updated_at")
      .single()

    if (error) throw error

    return NextResponse.json(staff)
  } catch (error) {
    console.error("[v0] Update staff error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update staff member" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    // Check if staff exists
    const { data: existing } = await supabase.from("staff").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase.from("staff").update({ is_active: false }).eq("id", id)

    if (error) throw error

    return NextResponse.json({ message: "Staff member deactivated successfully" })
  } catch (error) {
    console.error("[v0] Delete staff error:", error)
    return NextResponse.json({ error: "Failed to deactivate staff member" }, { status: 500 })
  }
}
