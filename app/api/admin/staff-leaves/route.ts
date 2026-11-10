import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"

const DATE = /^\d{4}-\d{2}-\d{2}$/

const LeaveSchema = z.object({
  staff_id: z.string().uuid(),
  start_date: z.string().regex(DATE, "Date invalide"),
  end_date: z.string().regex(DATE, "Date invalide"),
  reason: z.string().trim().max(200).optional(),
}).refine((data) => data.end_date >= data.start_date, {
  path: ["end_date"],
  message: "La fin du congé doit être après son début.",
})

const MANAGING_ROLES = ["admin", "manager", "receptionist"] as const

/** Leaves of one staff member (?staff_id=), or of a whole salon (?salon_id=). Past leaves stay listed 60 days. */
export async function GET(request: NextRequest) {
  const auth = requireStaffAuth(request, [...MANAGING_ROLES])
  if ("response" in auth) return auth.response
  const staffId = request.nextUrl.searchParams.get("staff_id")
  const salonId = request.nextUrl.searchParams.get("salon_id")
  if (!staffId && !salonId) return NextResponse.json({ error: "staff_id ou salon_id requis" }, { status: 400 })
  try {
    const supabase = createAdminClient()
    let staffIds: string[] | null = null
    if (!staffId && salonId) {
      const { data, error } = await supabase.from("staff").select("id").eq("salon_id", salonId)
      if (error) throw new Error(error.message)
      staffIds = (data || []).map((row) => row.id)
      if (!staffIds.length) return NextResponse.json({ leaves: [] })
    }
    const horizon = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    let query = supabase
      .from("staff_leaves")
      .select("id, staff_id, start_date, end_date, reason, created_by, created_at")
      .gte("end_date", horizon)
      .order("start_date", { ascending: true })
    query = staffId ? query.eq("staff_id", staffId) : query.in("staff_id", staffIds!)
    const { data, error } = await query
    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ error: "La migration des congés (2026-11-10_staff_leaves.sql) doit être installée." }, { status: 503 })
      }
      throw new Error(error.message)
    }
    return NextResponse.json({ leaves: data || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de lister les congés" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireStaffAuth(request, [...MANAGING_ROLES])
  if ("response" in auth) return auth.response
  const parsed = LeaveSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Congé invalide" }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    const { data: member, error: staffError } = await supabase
      .from("staff").select("id, first_name, last_name").eq("id", parsed.data.staff_id).single()
    if (staffError || !member) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 })

    const { data, error } = await supabase
      .from("staff_leaves")
      .insert({
        staff_id: parsed.data.staff_id,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        reason: parsed.data.reason || null,
        created_by: auth.payload.email || null,
      })
      .select("id, staff_id, start_date, end_date, reason, created_by, created_at")
      .single()
    if (error || !data) {
      if (error?.code === "42P01") {
        return NextResponse.json({ error: "La migration des congés (2026-11-10_staff_leaves.sql) doit être installée." }, { status: 503 })
      }
      throw new Error(error?.message || "Congé non enregistré")
    }
    return NextResponse.json({ leave: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d'enregistrer le congé" }, { status: 500 })
  }
}
