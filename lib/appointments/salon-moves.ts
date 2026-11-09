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

/** Every active staff account can use the planning pages, regardless of role or home salon. */
export async function authorizeSalonMove(supabase: ReturnType<typeof createAdminClient>, payload: JWTPayload, _salonId: string) {
  const { data: actor, error } = await supabase.from("staff")
    .select("id, salon_id, role, is_active").eq("id", payload.staffId).maybeSingle()
  if (error) throw new Error("Impossible de vérifier votre accès au planning.")
  return Boolean(actor && actor.is_active === true)
}
