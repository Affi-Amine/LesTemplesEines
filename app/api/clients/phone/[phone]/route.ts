import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ phone: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { phone } = await context.params

    // Decode the phone number (in case it's URL encoded)
    const decodedPhone = decodeURIComponent(phone)

    const supabase = await createClient()

    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("phone", decodedPhone)
      .single()

    if (error) {
      // Client not found
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Client not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error("[v0] Get client by phone error:", error)
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 })
  }
}
