import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateAppointmentSchema = z.object({
  status: z.enum(["confirmed", "pending", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  client_notes: z.string().optional(),
  internal_notes: z.string().optional(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const updates = UpdateAppointmentSchema.parse(body)

    if (!updates.status && !updates.client_notes && !updates.internal_notes) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Ensure appointment exists
    const { data: existing } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Perform update
    const { data, error } = await supabase
      .from("appointments")
      .update({
        status: updates.status,
        client_notes: updates.client_notes,
        internal_notes: updates.internal_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        `*,
        client:clients(*),
        staff:staff(id, first_name, last_name, role, phone),
        service:services(*),
        salon:salons(id, name, city, address)`
      )
      .single()

    if (error) {
      // Likely a Postgres CHECK constraint error when setting unknown status
      const message = error.message?.includes("status")
        ? "Invalid status value for appointment"
        : error.message
      return NextResponse.json({ error: message || "Failed to update appointment" }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Failed to update appointment" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: existing } = await supabase.from("appointments").select("id").eq("id", id).single()
    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const { error } = await supabase.from("appointments").delete().eq("id", id)
    if (error) throw error

    return NextResponse.json({ message: "Appointment deleted" })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 })
  }
}
