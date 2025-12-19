import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const UpdateServiceSchema = z.object({
  salon_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  duration_minutes: z.number().min(1).optional(),
  price_cents: z.number().min(0).optional(),
  category: z.string().optional(),
  image_url: z.string().optional(),
  is_active: z.boolean().optional(),
  required_staff_count: z.number().min(1).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: service, error } = await supabase.from("services").select("*").eq("id", id).single()

    if (error) throw error

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    return NextResponse.json(service)
  } catch (error) {
    console.error("[v0] Get service by ID error:", error)
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const serviceData = UpdateServiceSchema.parse(body)

    const supabase = await createAdminClient()

    // Check if service exists
    const { data: existing } = await supabase.from("services").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    // Update service
    const { data: service, error } = await supabase
      .from("services")
      .update(serviceData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(service)
  } catch (error) {
    console.error("[v0] Update service error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    // Check if service exists
    const { data: existing } = await supabase.from("services").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase.from("services").update({ is_active: false }).eq("id", id)

    if (error) throw error

    return NextResponse.json({ message: "Service deactivated successfully" })
  } catch (error) {
    console.error("[v0] Delete service error:", error)
    return NextResponse.json({ error: "Failed to deactivate service" }, { status: 500 })
  }
}
