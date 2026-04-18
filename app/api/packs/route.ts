import { createAdminClient } from "@/lib/supabase/admin"
import { PackSchema } from "@/lib/packs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export async function GET(request: NextRequest) {
  try {
    const activeOnly = request.nextUrl.searchParams.get("active")
    const supabase = createAdminClient()

    let query = supabase
      .from("packs")
      .select("*")
      .order("created_at", { ascending: false })

    if (activeOnly === "true") {
      query = query.eq("is_active", true)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[packs] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch packs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = PackSchema.parse(body)
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("packs")
      .insert([{
        ...payload,
        description: payload.description || null,
        allowed_installments: [...new Set(payload.allowed_installments)].sort((a, b) => a - b),
        is_active: payload.is_active ?? true,
      }])
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[packs] POST error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create pack" }, { status: 500 })
  }
}
