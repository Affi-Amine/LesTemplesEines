import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { authorizeSalonMove, SALON_MOVE_ACTION } from "@/lib/appointments/salon-moves"

export const dynamic = "force-dynamic"

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // A tuple cursor also handles two changes recorded at exactly the same instant.
  before: z.string().max(150).optional(),
})
const Cursor = z.object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() })

export async function GET(request: NextRequest, context: { params: Promise<{ salonId: string }> }) {
  const auth = requireStaffAuth(request)
  if ("response" in auth) return auth.response
  const salonId = z.string().uuid().safeParse((await context.params).salonId)
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!salonId.success || !parsed.success) return NextResponse.json({ error: "Journal demandé invalide." }, { status: 400 })
  let cursor: z.infer<typeof Cursor> | undefined
  if (parsed.data.before) {
    try { cursor = Cursor.parse(JSON.parse(Buffer.from(parsed.data.before, "base64url").toString("utf8"))) }
    catch { return NextResponse.json({ error: "Page du journal invalide." }, { status: 400 }) }
  }
  try {
    const supabase = createAdminClient()
    if (!await authorizeSalonMove(supabase, auth.payload, salonId.data)) return NextResponse.json({ error: "Vous n’avez pas accès au journal de ce salon." }, { status: 403 })
    let query = supabase.from("activity_logs").select("id, created_at, actor_id, entity_id, changes")
      .eq("salon_id", salonId.data).eq("action_type", SALON_MOVE_ACTION).eq("entity_type", "appointment")
      .eq("changes->>source", "salon_drag")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(parsed.data.limit + 1)
    if (cursor) query = query.or(`created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`)
    const { data, error } = await query
    if (error) throw new Error("Impossible de charger le journal des déplacements.")
    const entries = (data || []).slice(0, parsed.data.limit)
    const last = entries.at(-1)
    const next_cursor = data && data.length > parsed.data.limit && last
      ? Buffer.from(JSON.stringify({ at: last.created_at, id: last.id })).toString("base64url") : null
    return NextResponse.json({ entries, next_cursor })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Journal indisponible." }, { status: 500 })
  }
}
