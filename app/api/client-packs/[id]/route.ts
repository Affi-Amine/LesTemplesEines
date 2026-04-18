import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateClientPackSchema = z.object({
  remaining_sessions: z.number().int().min(0).optional(),
  payment_status: z.enum(["pending", "active", "partially_paid", "paid", "failed", "cancelled"]).optional(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const payload = UpdateClientPackSchema.parse(body)

    const supabase = createAdminClient()
    const { data: existing, error: existingError } = await supabase
      .from("client_packs")
      .select("id, total_sessions")
      .eq("id", id)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({ error: "Client pack not found" }, { status: 404 })
    }

    if (
      payload.remaining_sessions !== undefined &&
      payload.remaining_sessions > existing.total_sessions
    ) {
      return NextResponse.json({ error: "Remaining sessions cannot exceed total sessions" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("client_packs")
      .update(payload)
      .eq("id", id)
      .select(`
        *,
        client:clients(*),
        pack:packs(*)
      `)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("[client-packs] PATCH error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update client pack" }, { status: 500 })
  }
}
