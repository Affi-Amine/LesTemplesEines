import { issueManagementLink } from "@/lib/appointments/management"
import { sendEmail, isEmailEnabled } from "./resend"
import { clientAppointmentBookedSubject, clientAppointmentBookedHtml } from "./templates/appointment-confirmation-client"
import { adminAppointmentBookedSubject, adminAppointmentBookedHtml } from "./templates/appointment-new-booking-admin"
import { sendSms, isSmsEnabled } from "./templates/sms"

const APPOINTMENT_TIMEZONE = "Europe/Paris"
const APPOINTMENT_NOTIFICATION_EMAIL = "reservations@les-temples.com"
// The booking is already saved when we get here, so the link is a nicety: past
// this delay the confirmations leave without it rather than spend the whole
// function budget waiting for the insert.
const MANAGEMENT_LINK_TIMEOUT_MS = Number(process.env.MANAGEMENT_LINK_TIMEOUT_MS ?? 5000)

type NotificationOutcome = {
  channel: "email" | "sms"
  to: string
  status: "sent" | "skipped" | "failed"
  detail?: string
}

/**
 * Runs one notification and reports what happened instead of throwing, so a
 * provider refusing one recipient never cancels the others.
 */
async function attempt(
  channel: NotificationOutcome["channel"],
  to: string,
  send: () => Promise<any>,
): Promise<NotificationOutcome> {
  try {
    const result = await send()
    if (result?.skipped) return { channel, to, status: "skipped", detail: result.reason || "provider disabled" }
    return { channel, to, status: "sent", detail: result?.data?.id || result?.id || undefined }
  } catch (error) {
    return { channel, to, status: "failed", detail: error instanceof Error ? error.message : String(error) }
  }
}

async function managementLinkFor(appointment: any) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      issueManagementLink(appointment),
      new Promise<null>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Management link timed out")), MANAGEMENT_LINK_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    console.error("[booking-management] Confirmation sent without a management link; check the migration",
      error instanceof Error ? error.message : error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function sendAppointmentBookedEmails(
  appointment: any,
  options?: {
    bookingSource?: "client" | "admin"
  }
) {

  const salonName = appointment?.salon?.name
  const clientEmail: string | undefined = appointment?.client?.email ?? undefined
  const clientPhone: string | undefined = appointment?.client?.phone ?? undefined // ⬅️ pour le SMS
  const bookingSource = options?.bookingSource || "client"
  let managementUrl: string | null = null
  if (appointment?.id && ((isEmailEnabled && clientEmail) || (isSmsEnabled && clientPhone))) {
    managementUrl = await managementLinkFor(appointment)
  }

  const adminEnv = process.env.NOTIFICATIONS_ADMIN_EMAIL
  const adminEmails = Array.from(
    new Set(
      [APPOINTMENT_NOTIFICATION_EMAIL, ...(adminEnv ? adminEnv.split(",") : [])]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  )

  // Resend allows 2 requests per second on the default plan. The client mail and
  // the salon mail used to leave together, which put a single booking on that
  // limit and let a 429 drop one of them with only a log line to show for it.
  const outcomes: NotificationOutcome[] = []

  // ---------- EMAIL CLIENT ----------
  if (isEmailEnabled) {
    if (clientEmail) {
      outcomes.push(await attempt("email", clientEmail, () => sendEmail({
        to: clientEmail,
        subject: clientAppointmentBookedSubject({ salonName }),
        html: clientAppointmentBookedHtml(appointment, managementUrl),
      })))
    } else {
      console.log("[email] No client email present for appointment:", appointment?.id)
    }
  } else {
    console.log("[email] Disabled — skipping client booking email")
  }

  // ---------- EMAIL ADMIN ----------
  if (isEmailEnabled) {
    if (adminEmails.length > 0) {
      outcomes.push(await attempt("email", adminEmails.join(", "), () => sendEmail({
        to: adminEmails,
        subject: adminAppointmentBookedSubject({ salonName, bookingSource }),
        html: adminAppointmentBookedHtml(appointment, { bookingSource }),
      })))
    } else {
      console.log("[email] No admin notification recipients configured — skipping admin notification")
    }
  } else {
    console.log("[email] Disabled — skipping admin booking email")
  }

  // ---------- SMS CLIENT ----------
  if (clientPhone && isSmsEnabled) {
    // Petit formatage simple de la date/heure pour le SMS
    let when = ""
    try {
      if (appointment?.start_time) {
        const dt = new Date(appointment.start_time)
        when = dt.toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: APPOINTMENT_TIMEZONE,
        })
      }
    } catch {
      when = appointment?.start_time ?? ""
    }

    const smsMessage = salonName
        ? `Votre rendez-vous chez ${salonName} est confirmé${when ? ` le ${when}` : ""}.`
        : `Votre rendez-vous est confirmé${when ? ` le ${when}` : ""}.`

    outcomes.push(await attempt("sms", clientPhone, () => sendSms({
      to: clientPhone,
      message: smsMessage,
    })))
  } else if (!clientPhone) {
    console.log("[sms] No client phone present for appointment:", appointment?.id)
  } else if (!isSmsEnabled) {
    console.log("[sms] SMS disabled — skipping SMS notification")
  }

  // One line per booking saying who was reached and who was not: a confirmation
  // that never arrives leaves no other trace, here or in the back office.
  console.log("[notifications] Booking confirmation", {
    appointmentId: appointment?.id,
    bookingSource,
    managementLink: Boolean(managementUrl),
    outcomes,
  })
  const failures = outcomes.filter((outcome) => outcome.status === "failed")
  if (failures.length) {
    console.error("[notifications] Booking confirmation not delivered", {
      appointmentId: appointment?.id,
      failures,
    })
  }

  return outcomes
}
