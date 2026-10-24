import { createAdminClient } from "@/lib/supabase/admin"
import { issueManagementLink } from "@/lib/appointments/management"
import { MANAGEMENT_RULE, MANAGEMENT_REFUND } from "@/lib/appointments/management-policy"
import { sendEmail, isEmailEnabled } from "./resend"
import { sendSms, isSmsEnabled } from "./templates/sms"
import { escapeEmailHtml as html } from "./html"
import { presentAppointmentServices } from "@/lib/appointments/service-selection"

function appointmentWhen(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" }).format(new Date(value))
}

export async function sendManagementLinkToClient(appointment: any) {
  const canEmail = isEmailEnabled && Boolean(appointment.client?.email)
  const canSms = isSmsEnabled && Boolean(appointment.client?.phone)
  if (!canEmail && !canSms) throw new Error("Aucun canal de notification disponible pour ce client.")
  const url = await issueManagementLink(appointment)
  if (!url) throw new Error("Ce créneau ne possède pas de lien client.")
  const deliveries: Promise<unknown>[] = []
  if (canEmail) deliveries.push(sendEmail({ to: appointment.client.email, subject: "Gérez votre rendez-vous",
    html: `<div style="font-family:Arial,sans-serif;color:#172a24;line-height:1.6"><h2>Votre rendez-vous chez ${html(appointment.salon?.name || "Les Temples")}</h2><p>${html(appointmentWhen(appointment.start_time))}</p><p>${html(appointment.service?.name)}</p><p><a href="${html(url)}" style="display:inline-block;background:#dfeafb;color:#223f67;padding:12px 18px;border-radius:8px;font-weight:bold">Gérer mon rendez-vous</a></p><p>${html(MANAGEMENT_RULE)}</p><p>Le jour même, contactez directement le salon.</p><p>${html(MANAGEMENT_REFUND)}</p><p>Ce lien est personnel : ne le partagez pas.</p></div>` }))
  if (canSms) deliveries.push(sendSms({ to: appointment.client.phone,
    message: `Votre RDV chez ${appointment.salon?.name || "Les Temples"} : ${appointmentWhen(appointment.start_time)}. Gérer : ${url} Modification/annulation jusqu'à la veille uniquement. Remboursement : contacter le salon.` }))
  const results = await Promise.allSettled(deliveries)
  if (results.every(result => result.status === "rejected")) throw new Error("L’envoi du lien a échoué. Réessayez.")
}

export async function sendAppointmentClientChangedNotifications(appointment: any, action: "cancel" | "reschedule", previousStart: string) {
  const heading = action === "cancel" ? "Rendez-vous annulé" : "Rendez-vous déplacé"
  const text = action === "cancel" ? `Votre rendez-vous du ${appointmentWhen(previousStart)} est annulé.` :
    `Votre rendez-vous du ${appointmentWhen(previousStart)} a été déplacé au ${appointmentWhen(appointment.start_time)}.`
  const tasks: Promise<unknown>[] = []
  let url: string | null = null
  try { url = await issueManagementLink(appointment) } catch { /* The already-confirmed change must not be undone by a delivery failure. */ }
  if (isEmailEnabled && appointment.client?.email) tasks.push(sendEmail({ to: appointment.client.email, subject: heading,
    html: `<div style="font-family:Arial,sans-serif;color:#172a24;line-height:1.6"><h2>${html(heading)}</h2><p>${html(text)}</p><p>${html(appointment.service?.name)}</p><p>${html(appointment.salon?.name)}</p>${url ? `<p><a href="${html(url)}">Gérer mon rendez-vous</a></p>` : ""}<p>${html(MANAGEMENT_RULE)}</p><p>${html(MANAGEMENT_REFUND)}</p></div>` }))
  if (isSmsEnabled && appointment.client?.phone) tasks.push(sendSms({ to: appointment.client.phone,
    message: `${text} ${url ? `Gestion : ${url} ` : ""}${MANAGEMENT_REFUND}` }))
  const adminEmails = [...new Set(["reservations@les-temples.com", ...(process.env.NOTIFICATIONS_ADMIN_EMAIL || "").split(",")].map(value => value.trim()).filter(Boolean))]
  if (isEmailEnabled) tasks.push(sendEmail({ to: adminEmails, subject: `${heading} par le client – ${appointment.salon?.name || "Salon"}`,
    html: `<div style="font-family:Arial,sans-serif;color:#172a24;line-height:1.6"><h2>${html(heading)} par le client</h2><p>Client : ${html(appointment.client?.first_name)} ${html(appointment.client?.last_name)}</p><p>Ancien horaire : ${html(appointmentWhen(previousStart))}</p><p>Horaire du rendez-vous : ${html(appointmentWhen(appointment.start_time))}</p><p>Salon : ${html(appointment.salon?.name)}</p><p>Aucun remboursement automatique n’a été effectué.</p></div>` }))
  const results = await Promise.allSettled(tasks)
  if (!results.length || results.some(result => result.status === "rejected")) throw new Error("Une notification n’a pas pu être remise.")
}

export async function loadAppointmentForManagementDelivery(id: string) {
  const result = await createAdminClient().from("appointments").select("*,client:clients(first_name,last_name,email,phone),service:services(name),salon:salons(name)").eq("id", id).maybeSingle()
  if (result.error || !result.data) throw new Error("Rendez-vous introuvable.")
  return presentAppointmentServices(result.data)
}
