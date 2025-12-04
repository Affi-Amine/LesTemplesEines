import { sendEmail, isEmailEnabled } from "./resend"
import { clientAppointmentBookedSubject, clientAppointmentBookedHtml } from "./templates/appointment-confirmation-client"
import { adminAppointmentBookedSubject, adminAppointmentBookedHtml } from "./templates/appointment-new-booking-admin"
import { sendSms, isSmsEnabled } from "./templates/sms"

export async function sendAppointmentBookedEmails(appointment: any) {
  if (!isEmailEnabled) {
    console.log("[email] Disabled — skipping booking emails")
    // même si les emails sont désactivés, tu peux décider
    // d'envoyer quand même les SMS si tu veux :
    // if (!isSmsEnabled) return
    // mais pour l'instant on garde ton comportement existant.
    return
  }

  const salonName = appointment?.salon?.name
  const clientEmail: string | undefined = appointment?.client?.email ?? undefined
  const clientPhone: string | undefined = appointment?.client?.phone ?? undefined // ⬅️ pour le SMS

  const adminEnv = process.env.NOTIFICATIONS_ADMIN_EMAIL
  const adminEmails = adminEnv ? adminEnv.split(",").map((s) => s.trim()).filter(Boolean) : []

  const tasks: Promise<any>[] = []

  // ---------- EMAIL CLIENT ----------
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

  // ---------- EMAIL ADMIN ----------
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

  // ---------- SMS CLIENT ----------
  if (clientPhone && isSmsEnabled) {
    // Petit formatage simple de la date/heure pour le SMS
    let when = ""
    try {
      if (appointment?.start_time) {
        const dt = new Date(appointment.start_time)
        when = dt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
      }
    } catch {
      when = appointment?.start_time ?? ""
    }

    const smsMessage = salonName
        ? `Votre rendez-vous chez ${salonName} est confirmé${when ? ` le ${when}` : ""}.`
        : `Votre rendez-vous est confirmé${when ? ` le ${when}` : ""}.`

    tasks.push(
        sendSms({
          to: clientPhone,
          message: smsMessage,
        }),
    )
  } else if (!clientPhone) {
    console.log("[sms] No client phone present for appointment:", appointment?.id)
  } else if (!isSmsEnabled) {
    console.log("[sms] SMS disabled — skipping SMS notification")
  }

  // ---------- EXÉCUTION ----------
  try {
    await Promise.all(tasks)
  } catch (error) {
    console.error("[email/sms] One or more booking notifications failed:", error)
  }
}
