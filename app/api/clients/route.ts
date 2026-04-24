import { createAdminClient } from "@/lib/supabase/admin"
import { findClientByPhone } from "@/lib/client-auth"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const ClientSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,}/),
  email: z.string().email().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  internal_notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist", "assistant", "therapist"])
    if ("response" in auth) {
      return auth.response
    }

    const search = request.nextUrl.searchParams.get("search")
    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = Math.min(Math.max(Number.parseInt(limitParam || "20", 10) || 20, 1), 50)

    const supabase = await createAdminClient()

    let query = supabase.from("clients").select("*")

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`,
      )
    }

    // Newest first
    query = query.order("created_at", { ascending: false })

    const { data: clients, error } = await query

    if (error) throw error

    if (!search) {
      return NextResponse.json((clients || []).slice(0, limit))
    }

    const normalizedSearch = search.trim().toLowerCase()
    const scoreClient = (client: any) => {
      const fields = [
        client.first_name,
        client.last_name,
        client.phone,
        client.email,
      ]
        .filter(Boolean)
        .map((value: string) => value.toLowerCase())

      if (fields.some((value) => value.startsWith(normalizedSearch))) return 0
      if (fields.some((value) => value.includes(normalizedSearch))) return 1
      return 2
    }

    const rankedClients = [...(clients || [])]
      .sort((a, b) => scoreClient(a) - scoreClient(b))
      .slice(0, limit)

    return NextResponse.json(rankedClients)
  } catch (error) {
    console.error("[v0] Get clients error:", error)
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist", "assistant"])
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json()
    const clientData = ClientSchema.parse(body)

    const supabase = await createAdminClient()

    // Check if client already exists
    const existingClient = await findClientByPhone(clientData.phone)

    if (existingClient) {
      return NextResponse.json(existingClient, { status: 200 })
    }

    // Create new client
    const { data: client, error } = await supabase.from("clients").insert([clientData]).select().single()

    if (error) throw error

    // Create loyalty points record
    await supabase.from("loyalty_points").insert([
      {
        client_id: client.id,
        points_balance: 0,
        total_earned: 0,
        total_redeemed: 0,
      },
    ])

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error("[v0] Create client error:", error)
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 })
  }
}
