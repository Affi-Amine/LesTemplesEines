import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const UpdateClientSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,}/).optional(),
  email: z.string().email().optional().nullable(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  internal_notes: z.string().optional().nullable(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: client, error } = await supabase.from("clients").select("*").eq("id", id).single()

    if (error) throw error

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error("[v0] Get client by ID error:", error)
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const clientData = UpdateClientSchema.parse(body)

    const supabase = await createAdminClient()

    // Check if client exists
    const { data: existing } = await supabase.from("clients").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // If phone is being updated, check if it's already in use
    if (clientData.phone) {
      const { data: phoneExists } = await supabase
        .from("clients")
        .select("id")
        .eq("phone", clientData.phone)
        .neq("id", id)
        .single()

      if (phoneExists) {
        return NextResponse.json({ error: "Phone number already in use" }, { status: 409 })
      }
    }

    // Update client
    const { data: client, error } = await supabase.from("clients").update(clientData).eq("id", id).select().single()

    if (error) throw error

    return NextResponse.json(client)
  } catch (error) {
    console.error("[v0] Update client error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createAdminClient()

    // Check if client exists
    const { data: existing } = await supabase.from("clients").select("id").eq("id", id).single()

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Hard delete the client
    const { error } = await supabase.from("clients").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ message: "Client deleted successfully" })
  } catch (error) {
    console.error("[v0] Delete client error:", error)
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 })
  }
}
