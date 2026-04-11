import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")
    const status = request.nextUrl.searchParams.get("status")

    const supabase = createAdminClient()

    let query = supabase
      .from("gift_cards")
      .select(`
        *,
        service:services(
          id,
          name,
          duration_minutes,
          price_cents
        ),
        appointment:appointments(
          id,
          start_time,
          salon:salons(id, name, city)
        )
      `)
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    if (search) {
      query = query.or(
        `code.ilike.%${search}%,buyer_email.ilike.%${search}%,recipient_email.ilike.%${search}%,recipient_name.ilike.%${search}%`,
      )
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[gift-cards] Get gift cards error:", error)
    return NextResponse.json({ error: "Failed to fetch gift cards" }, { status: 500 })
  }
}
