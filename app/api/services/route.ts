import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const ServiceSchema = z.object({
  salon_id: z.string().uuid().optional(),
  salon_ids: z.array(z.string().uuid()).min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  duration_minutes: z.number().min(1),
  price_cents: z.number().min(0),
  category: z.string().nullable().optional(),
  image_url: z.string().optional(),
  is_active: z.boolean().optional(),
  required_staff_count: z.number().min(1).default(1),
}).refine((data) => Boolean(data.salon_id || (data.salon_ids && data.salon_ids.length > 0)), {
  message: "At least one salon must be selected",
})

function normalizeSalonIds(serviceData: z.infer<typeof ServiceSchema>) {
  return serviceData.salon_ids && serviceData.salon_ids.length > 0
    ? serviceData.salon_ids
    : serviceData.salon_id
      ? [serviceData.salon_id]
      : []
}

function mapService(service: any) {
  return {
    ...service,
    salon_ids: service.service_salons?.map((relation: any) => relation.salon_id) || [],
    salons: service.service_salons?.map((relation: any) => relation.salon).filter(Boolean) || [],
  }
}

export async function GET(request: NextRequest) {
  try {
    const salonIdOrSlug = request.nextUrl.searchParams.get("salon_id")

    const supabase = await createAdminClient()
    const selectClause = salonIdOrSlug
      ? `
        *,
        service_salons!inner(
          salon_id,
          salon:salons(id, name, slug, city)
        )
      `
      : `
        *,
        service_salons!left(
          salon_id,
          salon:salons(id, name, slug, city)
        )
      `

    let query = supabase
      .from("services")
      .select(selectClause)
      .eq("is_active", true)

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

        query = query.eq("service_salons.salon_id", salon.id)
      }

      if (isUUID) {
        query = query.eq("service_salons.salon_id", salonIdOrSlug)
      }
    }

    const { data: services, error } = await query

    if (error) throw error

    return NextResponse.json((services || []).map(mapService))
  } catch (error) {
    console.error("[v0] Get services error:", error)
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager"])
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json()
    const serviceData = ServiceSchema.parse(body)
    const salonIds = normalizeSalonIds(serviceData)

    const supabase = await createAdminClient()

    const servicePayload = {
      name: serviceData.name,
      description: serviceData.description,
      duration_minutes: serviceData.duration_minutes,
      price_cents: serviceData.price_cents,
      category: serviceData.category?.trim() || null,
      image_url: serviceData.image_url,
      is_active: serviceData.is_active ?? true,
      required_staff_count: serviceData.required_staff_count,
      salon_id: salonIds[0] ?? null,
    }

    const { data: service, error } = await supabase.from("services").insert([servicePayload]).select().single()

    if (error) throw error

    const { error: relationError } = await supabase
      .from("service_salons")
      .insert(salonIds.map((salonId) => ({ service_id: service.id, salon_id: salonId })))

    if (relationError) throw relationError

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

    return NextResponse.json(mapService(fullService), { status: 201 })
  } catch (error) {
    console.error("[v0] Create service error:", error)
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 })
  }
}
