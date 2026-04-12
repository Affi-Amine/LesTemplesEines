export type AppointmentPaymentStatus = "pending" | "paid" | "unpaid" | "failed" | "partial"

export function getPaymentStatusLabel(status?: string | null) {
  switch (status) {
    case "paid":
      return "Paye"
    case "pending":
      return "En attente"
    case "failed":
      return "Echoue"
    case "partial":
      return "Partiel"
    case "unpaid":
    default:
      return "Non paye"
  }
}

export function getPaymentStatusClass(status?: string | null) {
  switch (status) {
    case "paid":
      return "border-green-500 text-green-700 bg-green-50"
    case "pending":
      return "border-amber-500 text-amber-700 bg-amber-50"
    case "failed":
      return "border-red-500 text-red-700 bg-red-50"
    case "partial":
      return "border-yellow-500 text-yellow-700 bg-yellow-50"
    case "unpaid":
    default:
      return "border-slate-300 text-slate-700 bg-slate-50"
  }
}

export function getPaymentMethodLabel(method?: string | null) {
  switch (method) {
    case "stripe":
      return "Stripe"
    case "gift_card":
      return "Carte cadeau"
    case "on_site":
      return "Sur place"
    case "card":
      return "Carte bancaire"
    case "cash":
      return "Especes"
    case "check":
      return "Cheque"
    case "treatwell":
      return "Treatwell"
    case "loyalty":
      return "Points fidelite"
    case "mixed":
      return "Paiement mixte"
    case "other":
      return "Autre"
    default:
      return method || "-"
  }
}
