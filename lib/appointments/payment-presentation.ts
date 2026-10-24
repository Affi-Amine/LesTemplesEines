export interface AppointmentPaymentLike {
  status?: string | null
  payment_status?: string | null
  payment_method?: string | null
}

export function getAppointmentPayment(appointment: AppointmentPaymentLike) {
  if (appointment.status === "blocked") return null
  const status = appointment.payment_status
  const method = appointment.payment_method
  const online = method === "stripe"
  if (status === "paid") {
    if (online) return { state: "paid", channel: "online", label: "Payé en ligne", short: "En ligne", icon: "check", className: "border-sky-500 bg-sky-950 text-sky-100" }
    if (["card", "cash", "check", "on_site"].includes(method || "")) return { state: "paid", channel: "on-site", label: "Payé sur place", short: "Sur place", icon: "check", className: "border-emerald-500 bg-emerald-950 text-emerald-100" }
    const labels: Record<string, [string, string]> = {
      gift_card: ["Réglé par carte cadeau", "Carte cadeau"], pack: ["Réglé par forfait", "Forfait"],
      treatwell: ["Payé via Treatwell", "Treatwell"], loyalty: ["Réglé par fidélité", "Fidélité"],
      mixed: ["Payé · plusieurs moyens", "Mixte"],
    }
    const [label, short] = labels[method || ""] || ["Payé · mode non précisé", "Payé"]
    return { state: "paid", channel: method || "unknown", label, short, icon: "check", className: "border-teal-500 bg-teal-950 text-teal-100" }
  }
  if (status === "failed") return { state: "failed", channel: online ? "online" : "unknown", label: "Paiement échoué", short: "Échec", icon: "alert", className: "border-rose-500 bg-rose-950 text-rose-100" }
  if (status === "partial") return { state: "partial", channel: online ? "online" : "unknown", label: "Partiellement payé", short: "Partiel", icon: "partial", className: "border-amber-500 bg-amber-950 text-amber-100" }
  if (online) return { state: "pending", channel: "online", label: "Paiement en ligne en attente", short: "En attente", icon: "clock", className: "border-amber-500 bg-amber-950 text-amber-100" }
  const inactive = appointment.status === "cancelled" || appointment.status === "no_show"
  return { state: "unpaid", channel: "unknown", label: inactive ? "Non payé" : "À payer", short: inactive ? "Non payé" : "À payer", icon: "clock", className: "border-amber-500 bg-amber-950 text-amber-100" }
}
