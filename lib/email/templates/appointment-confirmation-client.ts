function formatDateTime(iso?: string) {
  if (!iso) return ""
  try {
    const dt = new Date(iso)
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(dt)
  } catch {
    return iso
  }
}

export function clientAppointmentBookedSubject(params: { salonName?: string }) {
  return params.salonName
    ? `Votre rendez-vous est confirmé – ${params.salonName}`
    : "Votre rendez-vous est confirmé"
}

export function clientAppointmentBookedHtml(appointment: any) {
  const salonName = appointment?.salon?.name ?? "Votre salon"
  const salonAddress = appointment?.salon?.address ?? ""
  const when = formatDateTime(appointment?.start_time)
  const service = appointment?.service?.name ?? "Massage"
  const staffName = [appointment?.staff?.first_name, appointment?.staff?.last_name].filter(Boolean).join(" ")

  const notes = appointment?.client_notes ? `<p><strong>Notes:</strong> ${appointment.client_notes}</p>` : ""

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111;">
    <h2 style="margin: 0 0 16px;">Confirmation de rendez-vous</h2>
    <p>Merci pour votre réservation. Voici les détails de votre rendez-vous:</p>
    <ul style="line-height: 1.6;">
      <li><strong>Salon:</strong> ${salonName}</li>
      ${salonAddress ? `<li><strong>Adresse:</strong> ${salonAddress}</li>` : ""}
      <li><strong>Date et heure:</strong> ${when}</li>
      <li><strong>Prestation:</strong> ${service}</li>
      ${staffName ? `<li><strong>Thérapeute:</strong> ${staffName}</li>` : ""}
    </ul>
    ${notes}
    <p style="margin-top: 16px;">Si vous devez modifier ou annuler votre rendez-vous, veuillez nous contacter dès que possible.</p>
    <p style="margin-top: 12px;">À bientôt,</p>
    <p style="margin: 0;">${salonName}</p>
  </div>
  `
}

