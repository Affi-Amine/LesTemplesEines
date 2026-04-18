import { createAdminClient } from "@/lib/supabase/admin"
import { PackSchema } from "@/lib/packs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const payload = PackSchema.partial().parse(body)

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updatePayload: Record<string, unknown> = { ...payload }

    if (payload.description !== undefined) {
      updatePayload.description = payload.description || null
    }

    if (payload.allowed_installments) {
      updatePayload.allowed_installments = [...new Set(payload.allowed_installments)].sort((a, b) => a - b)
    }

    const { data, error } = await supabase
      .from("packs")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("[packs] PATCH error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update pack" }, { status: 500 })
  }
}
