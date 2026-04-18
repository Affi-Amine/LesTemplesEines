import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")
    const status = request.nextUrl.searchParams.get("status")
    const supabase = createAdminClient()

    let query = supabase
      .from("client_packs")
      .select(`
        *,
        client:clients(*),
        pack:packs(*),
        usages:client_pack_usages(
          *,
          appointment:appointments(
            id,
            start_time,
            payment_method,
            service:services(id, name),
            salon:salons(id, name, city)
          )
        )
      `)
      .order("purchase_date", { ascending: false })

    if (status) {
      query = query.eq("payment_status", status)
    }

    const { data, error } = await query

    if (error) throw error
    const rows = data || []

    if (!search) {
      return NextResponse.json(rows)
    }

    const normalized = search.toLowerCase()
    return NextResponse.json(
      rows.filter((row: any) =>
        `${row.client?.first_name || ""} ${row.client?.last_name || ""}`.toLowerCase().includes(normalized)
        || String(row.client?.email || "").toLowerCase().includes(normalized)
        || String(row.pack?.name || "").toLowerCase().includes(normalized)
      )
    )
  } catch (error) {
    console.error("[client-packs] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch client packs" }, { status: 500 })
  }
}
