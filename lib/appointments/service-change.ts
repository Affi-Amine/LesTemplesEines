import { SchedulingError } from "@/lib/appointments/rules"

// What changing the prestation of an existing booking does to its payment.
// The scheduling side (free slot, masseuses able to do it, duo or solo, salon
// hours) is checked by validateAppointmentScheduling; this only covers money.

export interface ServiceChangePayment {
  previous_price_cents: number
  price_cents: number
  paid_cents: number
  /** Left to collect on site after the change. */
  due_cents: number
  /** Paid beyond the new price: to refund, or to keep as a credit. */
  overpaid_cents: number
  /** The client's pack still covers the new prestation, whatever its price. */
  covered_by_pack: boolean
  /** Columns to update on the booking; empty when its payment state is unchanged. */
  updates: { payment_status?: "paid" | "partial" }
}

export function planServiceChangePayment({ appointment, previousPriceCents, priceCents, serviceId, packAllowedServiceIds }: {
  appointment: { payment_status?: string | null; payment_method?: string | null; amount_paid_cents?: number | null }
  previousPriceCents: number
  priceCents: number
  serviceId: string
  /** Services of the client's pack when the booking was settled with one. */
  packAllowedServiceIds?: string[] | null
}): ServiceChangePayment {
  const status = appointment.payment_status || "unpaid"
  const paid = Math.max(0, appointment.amount_paid_cents || 0)
  const base = { previous_price_cents: previousPriceCents, price_cents: priceCents, paid_cents: paid, covered_by_pack: false }

  if (appointment.payment_method === "stripe" && status === "pending") {
    throw new SchedulingError("Le paiement en ligne de ce rendez-vous est en cours : attendez sa confirmation avant de changer la prestation.", 409)
  }

  if (appointment.payment_method === "pack" && status === "paid") {
    if (!packAllowedServiceIds?.includes(serviceId)) {
      throw new SchedulingError("Le forfait du client ne couvre pas cette prestation. Choisissez une prestation du forfait, ou annulez puis reprenez un rendez-vous réglé autrement.", 422)
    }
    // A pack session pays for one prestation of the pack, whatever its price.
    return { ...base, due_cents: 0, overpaid_cents: 0, covered_by_pack: true, updates: {} }
  }

  if (status === "paid" || status === "partial" || paid > 0) {
    const due = Math.max(0, priceCents - paid)
    const next = due > 0 ? "partial" : "paid"
    return { ...base, due_cents: due, overpaid_cents: Math.max(0, paid - priceCents), updates: next === status ? {} : { payment_status: next } }
  }

  return { ...base, due_cents: priceCents, overpaid_cents: 0, updates: {} }
}
