import { after, type NextRequest } from "next/server"
import { z } from "zod"
import { loadManagedAppointment, managedAppointmentView, managedSlots, ManagementError, MANAGEMENT_COOKIE } from "@/lib/appointments/management"
import { limitManagementRequests, managementBody, managementFailure, managementJSON } from "@/lib/appointments/management-http"
import { sendAppointmentClientChangedNotifications } from "@/lib/email/appointment-management"

export async function GET(request: NextRequest) {
  try {
    const session = await loadManagedAppointment(request.cookies.get(MANAGEMENT_COOKIE)?.value, request.nextUrl.searchParams.get("appointment_id") || undefined)
    limitManagementRequests(session.tokenHash)
    return managementJSON(managedAppointmentView(session.appointment))
  } catch (error) { return managementFailure(error) }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = z.object({ appointment_id: z.string().uuid(), request_id: z.string().uuid(),
      expected_updated_at: z.string().datetime({ offset: true }), action: z.enum(["cancel", "reschedule"]),
      start_time: z.string().datetime({ offset: true }).optional() }).strict().parse(await managementBody(request))
    const token = request.cookies.get(MANAGEMENT_COOKIE)?.value
    const session = await loadManagedAppointment(token, payload.appointment_id)
    limitManagementRequests(session.tokenHash, 30)
    if (payload.action === "reschedule") {
      if (!payload.start_time) throw new ManagementError("Choisissez un nouveau créneau.")
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(payload.start_time))
      const slots = await managedSlots(session, date)
      if (!slots.some(slot => Date.parse(slot.start) === Date.parse(payload.start_time!))) throw new ManagementError("Ce créneau n’est plus disponible. Votre ancien rendez-vous est conservé.", 409)
    }
    const result = await session.supabase.rpc("client_change_appointment", {
      p_token_hash: session.tokenHash, p_appointment_id: payload.appointment_id,
      p_request_id: payload.request_id, p_expected_updated_at: payload.expected_updated_at,
      p_action: payload.action, p_start_time: payload.start_time || null,
    })
    if (result.error) {
      const status = result.error.code === "28000" ? 401 : result.error.code === "42501" ? 403 :
        ["23P01","40001","40P01"].includes(result.error.code) ? 409 : result.error.code === "P0001" ? 400 : 503
      throw new ManagementError(status === 503 ? "La gestion du rendez-vous est momentanément indisponible. Contactez le salon." : result.error.code === "40P01" ? "Le planning est en cours de mise à jour. Réessayez ; votre rendez-vous est conservé." : result.error.message, status)
    }
    const updated = await loadManagedAppointment(token, payload.appointment_id)
    if (!result.data?.replayed) after(async () => {
      let notificationStatus = "sent"
      try { await sendAppointmentClientChangedNotifications(updated.appointment, payload.action, session.appointment.start_time) }
      catch { notificationStatus = "failed"; console.error("[booking-management] Change notification could not be delivered") }
      const tracked = await session.supabase.from("appointment_client_changes").update({ notification_status: notificationStatus,
        notified_at: notificationStatus === "sent" ? new Date().toISOString() : null }).eq("appointment_id", payload.appointment_id).eq("request_id", payload.request_id)
      if (tracked.error) console.error("[booking-management] Notification audit could not be updated")
    })
    return managementJSON(managedAppointmentView(updated.appointment))
  } catch (error) { return managementFailure(error) }
}
