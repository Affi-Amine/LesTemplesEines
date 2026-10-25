import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ClientProfileUpdateSchema, clientPhoneVariants } from "@/lib/clients/profile"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist", "assistant", "therapist"])
    if ("response" in auth) {
      return auth.response
    }

    const { id } = await context.params
    const supabase = await createAdminClient()

    const { data: client, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle()

    if (error) throw error

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json(client, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[v0] Get client by ID error:", error)
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist", "assistant"])
    if ("response" in auth) return auth.response
    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Identifiant client invalide." }, { status: 400 })
    const { expected_updated_at, ...clientData } = ClientProfileUpdateSchema.parse(await request.json())
    const supabase = createAdminClient()
    const existing = await supabase.from("clients").select("id,updated_at,phone,email").eq("id", id).maybeSingle()
    if (existing.error) throw existing.error
    if (!existing.data) return NextResponse.json({ error: "Cette fiche client n’existe plus." }, { status: 404 })
    if (expected_updated_at !== undefined && expected_updated_at !== existing.data.updated_at) {
      return NextResponse.json({ error: "Cette fiche a été modifiée ailleurs. Rouvrez-la avant d’enregistrer vos corrections." }, { status: 409 })
    }
    if (clientData.phone && clientData.phone !== existing.data.phone) {
      const duplicate = await supabase.from("clients").select("id").in("phone", clientPhoneVariants(clientData.phone)).neq("id", id).limit(1)
      if (duplicate.error) throw duplicate.error
      if (duplicate.data?.length) return NextResponse.json({ error: "Ce numéro de téléphone est déjà utilisé par une autre fiche client." }, { status: 409 })
    }
    if (clientData.email && clientData.email !== existing.data.email?.trim().toLowerCase()) {
      const duplicate = await supabase.from("clients").select("id").ilike("email", clientData.email.replace(/[\\%_]/g, character => `\\${character}`)).neq("id", id).limit(1)
      if (duplicate.error) throw duplicate.error
      if (duplicate.data?.length) return NextResponse.json({ error: "Cette adresse email est déjà utilisée par une autre fiche client." }, { status: 409 })
    }
    // Only contact fields change; IDs, accounts, bookings, packs and payments remain linked.
    let update = supabase.from("clients").update({ ...clientData, updated_at: new Date().toISOString() }).eq("id", id)
    update = existing.data.updated_at ? update.eq("updated_at", existing.data.updated_at) : update.is("updated_at", null)
    const result = await update.select("*").maybeSingle()
    if (result.error?.code === "23505") return NextResponse.json({ error: "Ces coordonnées sont déjà utilisées par une autre fiche client." }, { status: 409 })
    if (result.error) throw result.error
    if (!result.data) return NextResponse.json({ error: "La fiche vient de changer. Rouvrez-la avant de réessayer." }, { status: 409 })
    return NextResponse.json(result.data, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Vérifiez les informations du client.", details: error.issues }, { status: 400 })
    console.error("[clients] Profile update failed")
    return NextResponse.json({ error: "Impossible d’enregistrer la fiche client. Réessayez." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
    if ("response" in auth) {
      return auth.response
    }

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
