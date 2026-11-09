export interface CheckoutAppointment {
  id: string
  start_time: string
  end_time?: string
  updated_at?: string | null
  status?: string | null
  payment_status?: string | null
  payment_method?: string | null
  amount_paid_cents?: number | null
  service?: { name?: string | null; price_cents?: number | null } | null
  service_items?: { name?: string | null; price_cents?: number | null }[] | null
  client?: { first_name?: string | null; last_name?: string | null } | null
}

export const CHECKOUT_METHODS = [
  { value: "card", label: "Carte bancaire" },
  { value: "cash", label: "Espèces" },
  { value: "check", label: "Chèque" },
  { value: "treatwell", label: "Treatwell" },
  { value: "gift_card", label: "Carte cadeau" },
  { value: "loyalty", label: "Points fidélité" },
] as const

export interface CheckoutPaymentLine { method: string; amount: string }
const centsOrNull = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null

/** The booking's quote wins over the current catalogue, including combined soins. */
export function checkoutPriceCents(appointment?: CheckoutAppointment | null): number | null {
  if (!appointment) return 0
  if (appointment.service_items != null && (!Array.isArray(appointment.service_items) || appointment.service_items.length === 0)) return null
  const prices = appointment.service_items?.length
    ? appointment.service_items.map(item => centsOrNull(item.price_cents))
    : [centsOrNull(appointment.service?.price_cents)]
  if (prices.some(price => price === null)) return null
  const total = (prices as number[]).reduce((sum, price) => sum + price, 0)
  return Number.isSafeInteger(total) ? total : null
}

export function alreadyPaidCents(appointment?: CheckoutAppointment | null) {
  return centsOrNull(appointment?.amount_paid_cents) ?? 0
}

export function checkoutBalanceError(appointment: CheckoutAppointment) {
  if (appointment.payment_method === "stripe" && appointment.payment_status === "pending") return "Le paiement en ligne est en cours. Attendez sa confirmation avant d’encaisser."
  if (checkoutPriceCents(appointment) === null) return "Le tarif du rendez-vous est indisponible. Actualisez le planning."
  if ((appointment.payment_status === "partial" || appointment.amount_paid_cents != null) && centsOrNull(appointment.amount_paid_cents) === null) {
    return "Le montant déjà réglé est indisponible. Actualisez le planning."
  }
  return ""
}

export function amountDueCents(appointment?: CheckoutAppointment | null) {
  if (!appointment || appointment.payment_status === "paid" || checkoutBalanceError(appointment)) return 0
  return Math.max(0, (checkoutPriceCents(appointment) || 0) - alreadyPaidCents(appointment))
}

/** Parse decimal text directly; adding floating-point euros can change a cent. */
export function parseCheckoutCents(amount: string): number | null {
  const text = amount.trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null
  const [whole, decimals = ""] = text.replace(",", ".").split(".")
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0"))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

export const checkoutEuros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",")
export const checkoutAmountText = (cents: number) => (cents / 100).toFixed(2)

export function buildCheckoutPayload(appointment: CheckoutAppointment, lines: readonly CheckoutPaymentLine[]) {
  if (appointment.payment_status === "paid") throw new Error("Ce rendez-vous est déjà réglé.")
  if (["blocked", "cancelled", "no_show"].includes(appointment.status || "")) throw new Error("Ce rendez-vous ne peut pas être encaissé.")
  const balanceError = checkoutBalanceError(appointment)
  if (balanceError) throw new Error(balanceError)
  const due = amountDueCents(appointment)
  if (due <= 0) throw new Error("Aucun montant ne reste à encaisser.")
  if (!lines.length) throw new Error("Choisissez un moyen de paiement.")
  if (lines.length > 20) throw new Error("Utilisez au maximum 20 moyens de paiement.")
  const payments = lines.map(line => {
    if (!CHECKOUT_METHODS.some(method => method.value === line.method)) throw new Error("Choisissez un moyen de paiement valide.")
    const amount = parseCheckoutCents(line.amount)
    if (amount === null) throw new Error("Saisissez un montant supérieur à 0 €, avec deux décimales au maximum, pour chaque paiement.")
    return { method: line.method, amount_cents: amount }
  })
  const total = payments.reduce((sum, payment) => sum + payment.amount_cents, 0)
  if (!Number.isSafeInteger(total)) throw new Error("Le montant saisi est trop élevé.")
  if (total < due) throw new Error(`Il reste ${checkoutEuros(due - total)} € à répartir.`)
  if (total > due) throw new Error(`La répartition dépasse le solde de ${checkoutEuros(total - due)} €.`)
  if (appointment.updated_at != null && !Number.isFinite(Date.parse(appointment.updated_at))) {
    throw new Error("La version du rendez-vous est invalide. Actualisez le planning.")
  }
  return {
    payment_status: "paid" as const,
    payment_method: payments.length > 1 ? "mixed" : payments[0].method,
    amount_paid_cents: total + alreadyPaidCents(appointment),
    payments,
    ...(appointment.updated_at != null ? { expected_updated_at: appointment.updated_at } : {}),
  }
}
