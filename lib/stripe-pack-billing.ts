import type Stripe from "stripe"
import { getPackPaymentStatus } from "@/lib/packs"

// The subscription moved to parent.subscription_details in Stripe's Basil API.
export function getInvoiceSubscriptionId(invoice: any): string | null {
  const value = invoice.parent?.subscription_details?.subscription ?? invoice.subscription
  return typeof value === "string" ? value : value?.id || null
}

// Calculate from the original anchor, not from a clamped intermediate month.
export function getPackBillingEnd(anchor: number, count: number): number {
  if (!Number.isInteger(anchor) || !Number.isInteger(count) || count < 2 || count > 3) {
    throw new Error("Invalid finite installment plan")
  }
  const date = new Date(anchor * 1000)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + count)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return Math.floor(date.getTime() / 1000)
}

export async function getPaidPackInvoices(stripe: Stripe, subscriptionId: string, eventInvoice?: any) {
  const invoices = new Map<string, Stripe.Invoice>()
  let cursor: string | undefined
  do {
    const page = await stripe.invoices.list({ subscription: subscriptionId, status: "paid", limit: 100, ...(cursor ? { starting_after: cursor } : {}) })
    for (const invoice of page.data) {
      if (invoice.id && getInvoiceSubscriptionId(invoice) === subscriptionId && invoice.amount_paid > 0 &&
        ["subscription_create", "subscription_cycle"].includes(invoice.billing_reason || "")) {
        invoices.set(invoice.id, invoice)
      }
    }
    if (!page.has_more) break
    const next = page.data.at(-1)?.id
    if (!next || next === cursor) throw new Error("Stripe invoice pagination did not advance")
    cursor = next
  } while (cursor)
  // Include the current paid event if the list hasn't caught up yet.
  if (eventInvoice?.status === "paid" && eventInvoice.amount_paid > 0 &&
    getInvoiceSubscriptionId(eventInvoice) === subscriptionId &&
    ["subscription_create", "subscription_cycle"].includes(eventInvoice.billing_reason || "")) {
    invoices.set(eventInvoice.id, eventInvoice)
  }
  return [...invoices.values()]
}

export async function protectPackSubscription(stripe: Stripe, subscriptionId: string, count: number) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (["canceled", "incomplete_expired"].includes(subscription.status)) return subscription
  const end = getPackBillingEnd(subscription.billing_cycle_anchor, count)
  // Never reopen a canceled plan or postpone an earlier cancellation.
  if (subscription.cancel_at_period_end || (subscription.cancel_at && subscription.cancel_at <= end)) return subscription
  if (subscription.schedule) {
    // A schedule owns its subscription. Refuse to silently assume it's finite.
    const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
    if (schedule.end_behavior !== "cancel" || !schedule.phases.length || !Number.isFinite(schedule.phases.at(-1)!.end_date) || schedule.phases.at(-1)!.end_date > end) {
      throw new Error(`Pack schedule ${scheduleId} needs billing review`)
    }
    return subscription
  }
  return stripe.subscriptions.update(subscriptionId, {
    ...(end > Math.floor(Date.now() / 1000) ? { cancel_at: end } : { cancel_at_period_end: true }),
    proration_behavior: "none",
  })
}

export async function reconcilePackBilling(stripe: Stripe, supabase: any, clientPack: any, eventInvoice?: any) {
  const count = Number(clientPack.installment_count)
  if (![2, 3].includes(count)) throw new Error("Invalid Stripe pack installment count")
  const subscription = await protectPackSubscription(stripe, clientPack.stripe_subscription_id, count)
  const invoices = await getPaidPackInvoices(stripe, clientPack.stripe_subscription_id, eventInvoice)
  const paid = Math.min(count, invoices.length)
  if (invoices.length >= count && !["canceled", "incomplete_expired"].includes(subscription.status) && !subscription.cancel_at_period_end && !subscription.cancel_at && !subscription.schedule) {
    await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true, proration_behavior: "none" })
  }
  if (invoices.length > count) console.error("[stripe] PACK_OVERPAYMENT_REVIEW", { clientPackId: clientPack.id, subscriptionId: subscription.id, paidInvoiceCount: invoices.length, expected: count })
  const paymentStatus = clientPack.payment_status === "cancelled" ? "cancelled"
    : ["past_due", "unpaid"].includes(subscription.status) && paid < count ? "failed" : getPackPaymentStatus(count, paid)
  // A stale/concurrent event must never lower the already recorded count.
  const { error } = await supabase.from("client_packs").update({
    paid_installments: paid,
    payment_status: paymentStatus,
  }).eq("id", clientPack.id).lte("paid_installments", paid)
  if (error) throw error
  return { paid, invoiceCount: invoices.length, paymentStatus }
}
