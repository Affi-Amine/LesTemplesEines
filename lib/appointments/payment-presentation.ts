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
    if (online) return { state: "paid", channel: "online", label: "Payé en ligne", short: "En ligne", icon: "check", className: "border-sky-200 bg-sky-100 text-sky-950" }
    if (["card", "cash", "check", "on_site"].includes(method || "")) return { state: "paid", channel: "on-site", label: "Payé sur place", short: "Sur place", icon: "check", className: "border-emerald-200 bg-emerald-100 text-emerald-950" }
    const labels: Record<string, [string, string]> = {
      gift_card: ["Réglé par carte cadeau", "Carte cadeau"], pack: ["Réglé par forfait", "Forfait"],
      treatwell: ["Payé via Treatwell", "Treatwell"], loyalty: ["Réglé par fidélité", "Fidélité"],
      mixed: ["Payé · plusieurs moyens", "Mixte"],
    }
    const [label, short] = labels[method || ""] || ["Payé · mode non précisé", "Payé"]
    return { state: "paid", channel: method || "unknown", label, short, icon: "check", className: "border-teal-200 bg-teal-100 text-teal-950" }
  }
  if (status === "failed") return { state: "failed", channel: online ? "online" : "unknown", label: "Paiement échoué", short: "Échec", icon: "alert", className: "border-rose-200 bg-rose-100 text-rose-950" }
  if (status === "partial") return { state: "partial", channel: online ? "online" : "unknown", label: "Partiellement payé", short: "Partiel", icon: "partial", className: "border-amber-200 bg-amber-100 text-amber-950" }
  if (online) return { state: "pending", channel: "online", label: "Paiement en ligne en attente", short: "En attente", icon: "clock", className: "border-amber-200 bg-amber-100 text-amber-950" }
  const inactive = appointment.status === "cancelled" || appointment.status === "no_show"
  return { state: "unpaid", channel: "unknown", label: inactive ? "Non payé" : "À payer", short: inactive ? "Non payé" : "À payer", icon: "clock", className: "border-amber-200 bg-amber-100 text-amber-950" }
}
