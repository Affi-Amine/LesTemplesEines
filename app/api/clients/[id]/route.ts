import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const UpdateClientSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,}/).optional(),
  email: z.string().email().optional().nullable(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  internal_notes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const { data: client, error } = await supabase.from("clients").select("*").eq("id", params.id).single()

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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const clientData = UpdateClientSchema.parse(body)

    const supabase = await createClient()

    // Check if client exists
    const { data: existing } = await supabase.from("clients").select("id").eq("id", params.id).single()

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // If phone is being updated, check if it's already in use
    if (clientData.phone) {
      const { data: phoneExists } = await supabase
        .from("clients")
        .select("id")
        .eq("phone", clientData.phone)
        .neq("id", params.id)
        .single()

      if (phoneExists) {
        return NextResponse.json({ error: "Phone number already in use" }, { status: 409 })
      }
    }

    // Update client
    const { data: client, error } = await supabase.from("clients").update(clientData).eq("id", params.id).select().single()

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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    // Check if client exists
    const { data: existing } = await supabase.from("clients").select("id").eq("id", params.id).single()

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Hard delete the client (Note: This will cascade to related records if FK constraints are set up)
    const { error } = await supabase.from("clients").delete().eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ message: "Client deleted successfully" })
  } catch (error) {
    console.error("[v0] Delete client error:", error)
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 })
  }
}
