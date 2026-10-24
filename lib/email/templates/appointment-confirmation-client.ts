import { escapeEmailHtml as html } from "../html"
function formatDateTime(iso?: string) {
  if (!iso) return ""
  try {
    const dt = new Date(iso)
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(dt)
  } catch {
    return iso
  }
}

export function clientAppointmentBookedSubject(params: { salonName?: string }) {
  return params.salonName
    ? `Votre rendez-vous est confirmé – ${params.salonName}`
    : "Votre rendez-vous est confirmé"
}

export function clientAppointmentBookedHtml(appointment: any, managementUrl?: string | null) {
  const salonName = appointment?.salon?.name ?? "Votre salon"
  const salonAddress = appointment?.salon?.address ?? ""
  const when = formatDateTime(appointment?.start_time)
  const service = appointment?.service?.name ?? "Massage"
  const staffName = [appointment?.staff?.first_name, appointment?.staff?.last_name].filter(Boolean).join(" ")

  const notes = appointment?.client_notes ? `<p><strong>Notes:</strong> ${html(appointment.client_notes)}</p>` : ""

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111;">
    <h2 style="margin: 0 0 16px;">Confirmation de rendez-vous</h2>
    <p>Merci pour votre réservation. Voici les détails de votre rendez-vous:</p>
    <ul style="line-height: 1.6;">
      <li><strong>Salon:</strong> ${html(salonName)}</li>
      ${salonAddress ? `<li><strong>Adresse:</strong> ${html(salonAddress)}</li>` : ""}
      <li><strong>Date et heure:</strong> ${html(when)}</li>
      <li><strong>Prestation:</strong> ${html(service)}</li>
      ${staffName ? `<li><strong>Thérapeute:</strong> ${html(staffName)}</li>` : ""}
    </ul>
    ${notes}
    ${managementUrl ? `<p style="margin:24px 0"><a href="${html(managementUrl)}" style="display:inline-block;background:#dfeafb;color:#223f67;padding:12px 18px;border-radius:8px;font-weight:bold">Gérer mon rendez-vous</a></p><p>Modification et annulation possibles jusqu’à la veille à 23 h 59, heure de Paris. Le jour même, contactez directement le salon.</p><p>Pour toute demande de remboursement, veuillez contacter le salon.</p><p>Ce lien est personnel : ne le partagez pas.</p>` : `<p>Pour modifier ou annuler votre rendez-vous, contactez le salon.</p>`}
    <p style="margin-top: 12px;">À bientôt,</p>
    <p style="margin: 0;">${html(salonName)}</p>
  </div>
  `
}

