import { createHash, randomBytes } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/gift-cards"
import { getAppointmentStaffIds, canStaffTakeBookings } from "@/lib/calendar/scheduling"
import { getWorkingPeriods, intervalFitsPeriods, isScheduleDate } from "@/lib/calendar/working-periods"
import { fromZonedTime } from "date-fns-tz"
import { presentAppointmentServices } from "@/lib/appointments/service-selection"
import { resolveStaffIdsThatCanProvideService } from "@/lib/appointments/create"
import { managementDate, managementPermission, type ManagedAppointment } from "./management-policy"

export const MANAGEMENT_COOKIE = "bookingManagement"
export const MANAGEMENT_COOKIE_PATH = "/api/booking-management"
const VALID_TOKEN = /^[A-Za-z0-9_-]{43}$/
export class ManagementError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export const hashManagementToken = (token: string) => createHash("sha256").update(token).digest("hex")

export async function issueManagementLink(appointment: { id: string; end_time: string; status: string }, origin?: string) {
  if (appointment.status === "blocked") return null
  const token = randomBytes(32).toString("base64url")
  const expires = new Date(Math.max(Date.parse(appointment.end_time), Date.now()) + 7 * 86400_000).toISOString()
  const { error } = await createAdminClient().from("appointment_management_links").insert({
    appointment_id: appointment.id, token_hash: hashManagementToken(token), expires_at: expires,
  })
  if (error) throw new ManagementError("La gestion par lien n’est pas encore disponible. Contactez le salon.", 503)
  return `${getBaseUrl(origin)}/mon-rendez-vous#cle=${token}`
}

export async function loadManagedAppointment(token?: string, expectedId?: string) {
  if (!token || !VALID_TOKEN.test(token)) throw new ManagementError("Ce lien est invalide ou a expiré. Reprenez le lien reçu par SMS ou email.", 401)
  const supabase = createAdminClient(), tokenHash = hashManagementToken(token)
  const { data: link, error } = await supabase.from("appointment_management_links")
    .select("id, appointment_id, expires_at, revoked_at").eq("token_hash", tokenHash).maybeSingle()
  if (error) throw new ManagementError("La gestion du rendez-vous est momentanément indisponible. Contactez le salon.", 503)
  if (!link || link.revoked_at || Date.parse(link.expires_at) <= Date.now()) throw new ManagementError("Ce lien est invalide ou a expiré. Contactez le salon pour recevoir un nouveau lien.", 401)
  if (expectedId && expectedId !== link.appointment_id) throw new ManagementError("Un autre rendez-vous a été ouvert dans ce navigateur. Rouvrez le lien du rendez-vous souhaité.", 409)
  const result = await supabase.from("appointments").select(`*,
    client:clients(first_name,last_name,email,phone), service:services(id,name,price_cents,duration_minutes,required_staff_count),
    staff:staff(id,first_name,last_name), assignments:appointment_assignments(staff_id,staff:staff(id,first_name,last_name)),
    salon:salons(id,name,address,city,phone,email,opening_hours)`)
    .eq("id", link.appointment_id).maybeSingle()
  if (result.error || !result.data || result.data.status === "blocked") throw new ManagementError("Ce rendez-vous n’est plus accessible. Contactez le salon.", 404)
  return { supabase, tokenHash, link, appointment: presentAppointmentServices(result.data) }
}

export function managedAppointmentView(appointment: any): ManagedAppointment {
  const tomorrow = new Date(Date.parse(`${managementDate(new Date())}T12:00:00Z`) + 86400_000).toISOString().slice(0,10)
  const team = new Map<string,string>()
  if (appointment.staff?.id) team.set(appointment.staff.id, `${appointment.staff.first_name} ${appointment.staff.last_name}`.trim())
  for (const assignment of appointment.assignments || []) if (assignment.staff?.id) team.set(assignment.staff.id, `${assignment.staff.first_name} ${assignment.staff.last_name}`.trim())
  return {
    id: appointment.id, version: appointment.updated_at || appointment.created_at || appointment.start_time,
    status: appointment.status, start_time: appointment.start_time, end_time: appointment.end_time,
    client_name: [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).join(" "),
    service_name: appointment.service?.name || "Massage", duration_minutes: (Date.parse(appointment.end_time) - Date.parse(appointment.start_time)) / 60000,
    price_cents: appointment.service?.price_cents || 0, staff_names: [...team.values()],
    payment_status: appointment.payment_status || "unpaid", payment_method: appointment.payment_method || null,
    amount_paid_cents: appointment.amount_paid_cents || 0,
    salon: { name: appointment.salon?.name || "Votre salon", address: appointment.salon?.address || "", city: appointment.salon?.city || "", phone: appointment.salon?.phone || null, email: appointment.salon?.email || null },
    permission: managementPermission(appointment), tomorrow,
  }
}

export async function managedSlots(session: Awaited<ReturnType<typeof loadManagedAppointment>>, date: string) {
  if (!managementPermission(session.appointment).allowed) throw new ManagementError(managementPermission(session.appointment).reason, 403)
  if (!isScheduleDate(date) || date <= managementDate(new Date())) throw new ManagementError("Choisissez une date à partir de demain.")
  const { supabase, appointment } = session
  const ids = getAppointmentStaffIds(appointment)
  if (!ids.length) return []
  const [members, shifts, bookings, assignments] = await Promise.all([
    supabase.from("staff").select("id,salon_id,is_active,role").in("id", ids),
    supabase.from("staff_availability").select("staff_id,is_recurring,day_of_week,specific_date,start_time,end_time").in("staff_id", ids),
    supabase.from("appointments").select("id,staff_id,start_time,end_time,status").in("staff_id", ids)
      .in("status", ["confirmed","pending","blocked","in_progress"]).neq("id", appointment.id)
      .lt("start_time", fromZonedTime(`${date}T23:59:59.999`, "Europe/Paris").toISOString()).gt("end_time", fromZonedTime(`${date}T00:00:00`, "Europe/Paris").toISOString()),
    supabase.from("appointment_assignments").select("staff_id,appointment:appointments!inner(id,start_time,end_time,status)").in("staff_id", ids)
      .filter("appointment.status", "in", '("confirmed","pending","blocked","in_progress")').neq("appointment.id", appointment.id)
      .lt("appointment.start_time", fromZonedTime(`${date}T23:59:59.999`, "Europe/Paris").toISOString()).gt("appointment.end_time", fromZonedTime(`${date}T00:00:00`, "Europe/Paris").toISOString()),
  ])
  for (const result of [members, shifts, bookings, assignments]) if (result.error) throw new ManagementError("Impossible de vérifier les disponibilités. Réessayez.", 503)
  if (members.data?.length !== ids.length || members.data.some(member => !canStaffTakeBookings(member) || member.salon_id !== appointment.salon_id)) return []
  for (const serviceId of appointment.service_items?.map((item: any) => item.id) || [appointment.service_id]) {
    if ((await resolveStaffIdsThatCanProvideService(supabase, ids, serviceId)).length !== ids.length) return []
  }
  const duration = Date.parse(appointment.end_time) - Date.parse(appointment.start_time)
  if (duration <= 0 || duration > 86400_000) return []
  const periods = ids.map(id => getWorkingPeriods(date, appointment.salon?.opening_hours, (shifts.data || []).filter(shift => shift.staff_id === id)))
  const busy = [...(bookings.data || []), ...(assignments.data || []).map((assignment: any) => assignment.appointment).filter(Boolean)]
  const slots: Array<{ start: string; end: string }> = []
  const dayStart = fromZonedTime(`${date}T00:00:00`, "Europe/Paris").getTime()
  const dayEnd = fromZonedTime(`${date}T23:59:59`, "Europe/Paris").getTime()
  for (let start = dayStart; start + duration <= dayEnd; start += 15 * 60000) {
    const end = start + duration
    if (periods.every(period => intervalFitsPeriods(new Date(start), new Date(end), period)) &&
      !busy.some(booking => Date.parse(booking.start_time) < end && Date.parse(booking.end_time) > start)) slots.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() })
  }
  return slots
}
