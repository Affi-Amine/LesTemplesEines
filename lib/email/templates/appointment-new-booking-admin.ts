function formatDateTime(iso?: string) {
  if (!iso) return ""
  try {
    const dt = new Date(iso)
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(dt)
  } catch {
    return iso
  }
}

export function adminAppointmentBookedSubject(params: { salonName?: string }) {
  return params.salonName
    ? `Nouvelle réservation – ${params.salonName}`
    : "Nouvelle réservation"
}

export function adminAppointmentBookedHtml(appointment: any) {
  const salonName = appointment?.salon?.name ?? "Salon"
  const when = formatDateTime(appointment?.start_time)
  const service = appointment?.service?.name ?? "Prestation"
  const staffName = [appointment?.staff?.first_name, appointment?.staff?.last_name].filter(Boolean).join(" ")
  const client = appointment?.client || {}
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(" ")
  const clientEmail = client?.email ?? ""
  const clientPhone = client?.phone ?? ""
  const notes = appointment?.client_notes ? `<p><strong>Notes client:</strong> ${appointment.client_notes}</p>` : ""

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111;">
    <h2 style="margin: 0 0 16px;">Nouvelle réservation</h2>
    <p>Une nouvelle réservation a été créée.</p>
    <ul style="line-height: 1.6;">
      <li><strong>Salon:</strong> ${salonName}</li>
      <li><strong>Date et heure:</strong> ${when}</li>
      <li><strong>Prestation:</strong> ${service}</li>
      ${staffName ? `<li><strong>Thérapeute:</strong> ${staffName}</li>` : ""}
      ${clientName ? `<li><strong>Client:</strong> ${clientName}</li>` : ""}
      ${clientEmail ? `<li><strong>Email:</strong> ${clientEmail}</li>` : ""}
      ${clientPhone ? `<li><strong>Téléphone:</strong> ${clientPhone}</li>` : ""}
    </ul>
    ${notes}
  </div>
  `
}

