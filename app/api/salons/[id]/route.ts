import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const UpdateSalonSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  siret: z.string().optional(),
  opening_hours: z
    .record(
      z.string(),
      z.object({ open: z.string(), close: z.string() })
    )
    .optional(),
  is_active: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: salon, error } = await supabase.from("salons").select("*").eq("id", id).single()

    if (error) throw error

    if (!salon) {
      return NextResponse.json({ error: "Salon not found" }, { status: 404 })
    }

    return NextResponse.json(salon)
  } catch (error) {
    console.error("[v0] Get salon by ID error:", error)
    return NextResponse.json({ error: "Failed to fetch salon" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const salonData = UpdateSalonSchema.parse(body)

    const supabase = await createAdminClient()

    // Check if salon exists
    const { data: existing } = await supabase.from("salons").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Salon not found" }, { status: 404 })
    }

    // Prevent duplicate slug if updating
    if (salonData.slug) {
      const { data: slugExists } = await supabase
        .from("salons")
        .select("id")
        .eq("slug", salonData.slug)
        .neq("id", id)
        .single()

      if (slugExists) {
        return NextResponse.json({ error: "Slug already in use" }, { status: 409 })
      }
    }

    const { data: salon, error } = await supabase.from("salons").update(salonData).eq("id", id).select().single()

    if (error) throw error

    return NextResponse.json(salon)
  } catch (error) {
    console.error("[v0] Update salon error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update salon" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    // Check if salon exists
    const { data: existing } = await supabase.from("salons").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Salon not found" }, { status: 404 })
    }

    // Soft delete
    const { error } = await supabase.from("salons").update({ is_active: false }).eq("id", id)

    if (error) throw error

    return NextResponse.json({ message: "Salon deactivated successfully" })
  } catch (error) {
    console.error("[v0] Delete salon error:", error)
    return NextResponse.json({ error: "Failed to deactivate salon" }, { status: 500 })
  }
}