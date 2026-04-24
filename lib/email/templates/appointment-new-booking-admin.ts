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

export function adminAppointmentBookedSubject(params: { salonName?: string; bookingSource?: "client" | "admin" }) {
  return params.salonName
    ? `Nouvelle réservation (${params.bookingSource === "admin" ? "créée depuis l'admin" : "prise par un client"}) – ${params.salonName}`
    : `Nouvelle réservation (${params.bookingSource === "admin" ? "créée depuis l'admin" : "prise par un client"})`
}

export function adminAppointmentBookedHtml(
  appointment: any,
  options?: {
    bookingSource?: "client" | "admin"
  }
) {
  const salonName = appointment?.salon?.name ?? "Salon"
  const when = formatDateTime(appointment?.start_time)
  const service = appointment?.service?.name ?? "Prestation"
  const staffName = [appointment?.staff?.first_name, appointment?.staff?.last_name].filter(Boolean).join(" ")
  const client = appointment?.client || {}
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(" ")
  const clientEmail = client?.email ?? ""
  const clientPhone = client?.phone ?? ""
  const notes = appointment?.client_notes ? `<p><strong>Notes client:</strong> ${appointment.client_notes}</p>` : ""
  const bookingSource = options?.bookingSource === "admin" ? "admin" : "client"
  const sourceLabel =
    bookingSource === "admin"
      ? "RÉSERVATION CRÉÉE DEPUIS LE TABLEAU ADMIN"
      : "RÉSERVATION PRISE PAR UN CLIENT SUR LE SITE"
  const sourceDescription =
    bookingSource === "admin"
      ? "Cette réservation a été enregistrée manuellement depuis le tableau d'administration."
      : "Cette réservation a été effectuée directement par un client sur le site."

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111;">
    <h2 style="margin: 0 0 16px;">Nouvelle réservation</h2>
    <div style="margin: 0 0 16px; padding: 12px 14px; border-radius: 10px; background: ${bookingSource === "admin" ? "#fff4e5" : "#e8f5e9"}; border: 1px solid ${bookingSource === "admin" ? "#f5c26b" : "#8bc79a"};">
      <p style="margin: 0 0 6px; font-size: 13px; font-weight: 800; letter-spacing: 0.04em;">${sourceLabel}</p>
      <p style="margin: 0; font-size: 14px;">${sourceDescription}</p>
    </div>
    <ul style="line-height: 1.6;">
      <li><strong>Origine:</strong> ${bookingSource === "admin" ? "Tableau admin" : "Site client"}</li>
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

