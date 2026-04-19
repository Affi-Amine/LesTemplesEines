import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createAdminClient()

    const [{ count: salonsCount, error: salonsError }, { count: staffCount, error: staffError }, { count: clientsCount, error: clientsError }] = await Promise.all([
      supabase.from("salons").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("staff").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("clients").select("*", { count: "exact", head: true }),
    ])

    if (salonsError) throw salonsError
    if (staffError) throw staffError
    if (clientsError) throw clientsError

    return NextResponse.json({
      salons: salonsCount || 0,
      staff: staffCount || 0,
      clients: clientsCount || 0,
    })
  } catch (error) {
    console.error("[public/home-stats] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch home stats" }, { status: 500 })
  }
}
