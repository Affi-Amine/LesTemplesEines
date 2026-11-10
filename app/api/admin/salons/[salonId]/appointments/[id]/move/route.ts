import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { authorizeSalonMove } from "@/lib/appointments/salon-moves"
import { getStaffOnLeave } from "@/lib/staff/leaves"
import { syncAfterBookingChange } from "@/lib/sync/trigger"

export const dynamic = "force-dynamic"

const Params = z.object({ salonId: z.string().uuid(), id: z.string().uuid() })
// This endpoint cannot accept a new duration, payment, status, service, client or salon.
const Move = z.object({
  start_time: z.string().datetime({ offset: true }),
  staff_ids: z.array(z.string().uuid()).min(1).max(20).refine(ids => new Set(ids).size === ids.length, "Équipe invalide"),
  expected_updated_at: z.string().datetime({ offset: true }),
  request_id: z.string().uuid(),
}).strict()

export async function POST(request: NextRequest, context: { params: Promise<{ salonId: string; id: string }> }) {
  const auth = requireStaffAuth(request)
  if ("response" in auth) return auth.response
  const params = Params.safeParse(await context.params)
  const parsed = Move.safeParse(await request.json().catch(() => null))
  if (!params.success || !parsed.success) return NextResponse.json({ error: "Déplacement invalide. Actualisez le planning puis réessayez." }, { status: 400 })
  const { salonId, id } = params.data
  try {
    const supabase = createAdminClient()
    if (!await authorizeSalonMove(supabase, auth.payload, salonId)) return NextResponse.json({ error: "Vous n’avez pas accès aux déplacements libres de ce salon." }, { status: 403 })
    // The drag keeps the appointment's duration; a slot on a leave day is
    // refused here because the atomic RPC only knows about booking conflicts.
    const { data: moving } = await supabase.from("appointments").select("start_time, end_time").eq("id", id).single()
    const movedEnd = moving
      ? new Date(Date.parse(parsed.data.start_time) + (Date.parse(moving.end_time) - Date.parse(moving.start_time))).toISOString()
      : parsed.data.start_time
    const onLeave = await getStaffOnLeave(supabase, parsed.data.staff_ids, parsed.data.start_time, movedEnd)
    if (onLeave.size > 0) return NextResponse.json({ error: "La masseuse est en congé à cette date." }, { status: 409 })
    const { data, error } = await supabase.rpc("salon_drag_appointment_atomic", {
      p_salon_id: salonId,
      p_appointment_id: id,
      p_expected_updated_at: parsed.data.expected_updated_at,
      p_start_time: parsed.data.start_time,
      p_staff_ids: parsed.data.staff_ids,
      p_actor_id: auth.payload.staffId,
      p_request_id: parsed.data.request_id,
    })
    if (error) {
      const missing = ["42883", "PGRST202"].includes(error.code || "")
      const status = missing ? 503 : ["PT409", "40001", "23505"].includes(error.code || "") ? 409 : error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400
      return NextResponse.json({ error: missing
        ? "La migration des déplacements libres et du journal doit être installée. Aucun rendez-vous n’a été déplacé."
        : error.message || "Le déplacement n’a pas été enregistré." }, { status })
    }
    if (!data?.appointment?.id || !data?.change?.id) return NextResponse.json({ error: "La confirmation du déplacement et de son journal est incomplète. Actualisez le planning avant de réessayer." }, { status: 502 })
    if (!data.replayed) syncAfterBookingChange("salon-drag", data.change.changes?.before?.start_time, data.appointment.start_time)
    return NextResponse.json({ id: data.appointment.id, updated_at: data.appointment.updated_at, change_id: data.change.id, replayed: Boolean(data.replayed) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de déplacer le rendez-vous." }, { status: 500 })
  }
}
