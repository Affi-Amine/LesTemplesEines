import type { JWTPayload } from "@/lib/auth/jwt"
import { createAdminClient } from "@/lib/supabase/admin"

export const SALON_MOVE_ACTION = "salon_appointment_moved"

export type SalonMoveSnapshot = {
  start_time: string
  end_time: string
  staff_ids: string[]
  staff?: { id: string; name: string }[]
}

export type SalonMoveLog = {
  id: string
  created_at: string
  actor_id: string
  entity_id: string
  changes: {
    source: "salon_drag"
    request_id: string
    actor?: { name: string; role: string }
    client?: { name: string }
    service?: { name: string }
    before: SalonMoveSnapshot
    after: SalonMoveSnapshot
    overrides?: string[]
  }
}

/** Planning access follows the signed-in staff account. is_active controls bookability, not login access. */
export async function authorizeSalonMove(supabase: ReturnType<typeof createAdminClient>, payload: JWTPayload, _salonId: string) {
  const staffRoles = ["admin", "manager", "receptionist", "assistant", "therapist"]
  if (!payload.staffId || !staffRoles.includes(payload.role)) return false
  const { data: actor, error } = await supabase.from("staff")
    .select("id, role").eq("id", payload.staffId).maybeSingle()
  if (error) throw new Error("Impossible de vérifier votre accès au planning.")
  return Boolean(actor && staffRoles.includes(actor.role))
}
