import { createAdminClient } from "@/lib/supabase/admin"
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
    const search = request.nextUrl.searchParams.get("search")

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

    return NextResponse.json(clients)
  } catch (error) {
    console.error("[v0] Get clients error:", error)
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const clientData = ClientSchema.parse(body)

    const supabase = await createAdminClient()

    // Check if client already exists
    const { data: existingClient } = await supabase
      .from("clients")
      .select("*")
      .eq("phone", clientData.phone)
      .single()

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
