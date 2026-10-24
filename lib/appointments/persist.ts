import type { createAdminClient } from "@/lib/supabase/admin"
import { SchedulingError } from "@/lib/appointments/rules"

const APPOINTMENT_SELECT = `*,
  client:clients(*), staff:staff(id, first_name, last_name, role, phone),
  assignments:appointment_assignments(staff_id, staff:staff(id, first_name, last_name)),
  service:services(*), salon:salons(id, name, city, address)`

// Scheduling and assignments are committed together. No fallback to separate
// writes: a missing migration must fail visibly, never weaken integrity.
export async function persistAppointmentSchedule(
  supabase: ReturnType<typeof createAdminClient>,
  appointment: Record<string, unknown>,
  staffIds?: string[],
  appointmentId?: string,
) {
  const { data: id, error } = await supabase.rpc("save_appointment_schedule", {
    p_appointment: appointment,
    p_staff_ids: staffIds ?? null,
    p_appointment_id: appointmentId ?? null,
  })
  if (error) {
    if (error.code === "PGRST202") throw new Error("Migration salon_booking_integrity requise avant la mise en service")
    if (error.code === "23P01" || error.code === "40001") throw new SchedulingError("Ce créneau vient d'être modifié ou réservé. Rechargez le planning.", 409)
    if (error.code === "23514" || error.code === "22023") throw new SchedulingError(error.message)
    throw new Error(error.message)
  }
  const { data, error: readError } = await supabase.from("appointments").select(APPOINTMENT_SELECT).eq("id", id).single()
  if (readError || !data) throw new Error(readError?.message || "Rendez-vous enregistré mais relecture impossible ; rechargez le planning avant de réessayer")
  return data
}
