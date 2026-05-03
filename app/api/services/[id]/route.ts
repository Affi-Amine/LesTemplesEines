import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const UpdateServiceSchema = z.object({
  salon_id: z.string().uuid().optional(),
  salon_ids: z.array(z.string().uuid()).min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  duration_minutes: z.number().min(1).optional(),
  price_cents: z.number().min(0).optional(),
  category: z.string().nullable().optional(),
  image_url: z.string().optional(),
  is_active: z.boolean().optional(),
  required_staff_count: z.number().min(1).optional(),
})

function normalizeSalonIds(serviceData: z.infer<typeof UpdateServiceSchema>) {
  return serviceData.salon_ids && serviceData.salon_ids.length > 0
    ? serviceData.salon_ids
    : serviceData.salon_id
      ? [serviceData.salon_id]
      : undefined
}

function mapService(service: any) {
  return {
    ...service,
    salon_ids: service.service_salons?.map((relation: any) => relation.salon_id) || [],
    salons: service.service_salons?.map((relation: any) => relation.salon).filter(Boolean) || [],
  }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: service, error } = await supabase
      .from("services")
      .select(`
        *,
        service_salons!left(
          salon_id,
          salon:salons(id, name, slug, city)
        )
      `)
      .eq("id", id)
      .single()

    if (error) throw error

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    return NextResponse.json(mapService(service))
  } catch (error) {
    console.error("[v0] Get service by ID error:", error)
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager"])
    if ("response" in auth) {
      return auth.response
    }

    const { id } = await context.params
    const body = await request.json()
    const serviceData = UpdateServiceSchema.parse(body)
    const salonIds = normalizeSalonIds(serviceData)

    const supabase = await createAdminClient()

    // Check if service exists
    const { data: existing } = await supabase.from("services").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    // Update service
    const updatePayload: Record<string, unknown> = { ...serviceData }
    delete updatePayload.salon_ids
    if ("category" in serviceData) {
      updatePayload.category = serviceData.category?.trim() || null
    }
    if (salonIds) {
      updatePayload.salon_id = salonIds[0] ?? null
    }

    const { data: service, error } = await supabase
      .from("services")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    if (salonIds) {
      const { error: deleteRelationError } = await supabase
        .from("service_salons")
        .delete()
        .eq("service_id", id)

      if (deleteRelationError) throw deleteRelationError

      const { error: insertRelationError } = await supabase
        .from("service_salons")
        .insert(salonIds.map((salonId) => ({ service_id: id, salon_id: salonId })))

      if (insertRelationError) throw insertRelationError
    }

    const { data: fullService, error: fullServiceError } = await supabase
      .from("services")
      .select(`
        *,
        service_salons!left(
          salon_id,
          salon:salons(id, name, slug, city)
        )
      `)
      .eq("id", service.id)
      .single()

    if (fullServiceError) throw fullServiceError

    return NextResponse.json(mapService(fullService))
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
    const auth = requireStaffAuth(request, ["admin", "manager"])
    if ("response" in auth) {
      return auth.response
    }

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
