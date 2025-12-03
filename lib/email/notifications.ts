import { sendEmail, isEmailEnabled } from "./resend"
import { clientAppointmentBookedSubject, clientAppointmentBookedHtml } from "./templates/appointment-confirmation-client"
import { adminAppointmentBookedSubject, adminAppointmentBookedHtml } from "./templates/appointment-new-booking-admin"

export async function sendAppointmentBookedEmails(appointment: any) {
  if (!isEmailEnabled) {
    console.log("[email] Disabled — skipping booking emails")
    return
  }

  const salonName = appointment?.salon?.name
  const clientEmail: string | undefined = appointment?.client?.email ?? undefined
  const adminEnv = process.env.NOTIFICATIONS_ADMIN_EMAIL
  const adminEmails = adminEnv ? adminEnv.split(",").map((s) => s.trim()).filter(Boolean) : []

  const tasks: Promise<any>[] = []

  if (clientEmail) {
    tasks.push(
      sendEmail({
        to: clientEmail,
        subject: clientAppointmentBookedSubject({ salonName }),
        html: clientAppointmentBookedHtml(appointment),
      }),
    )
  } else {
    console.log("[email] No client email present for appointment:", appointment?.id)
  }

  if (adminEmails.length > 0) {
    tasks.push(
      sendEmail({
        to: adminEmails,
        subject: adminAppointmentBookedSubject({ salonName }),
        html: adminAppointmentBookedHtml(appointment),
      }),
    )
  } else {
    console.log("[email] NOTIFICATIONS_ADMIN_EMAIL not set — skipping admin notification")
  }

  try {
    await Promise.all(tasks)
  } catch (error) {
    console.error("[email] One or more booking emails failed:", error)
  }
}

