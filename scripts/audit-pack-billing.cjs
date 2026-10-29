// READ ONLY. No cancellation, refund, database update or Stripe mutation.
// node --env-file=.env scripts/audit-pack-billing.cjs
const { createClient } = require('@supabase/supabase-js')
const Stripe = require('stripe')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
const subscriptionId = invoice => {
  const value = invoice.parent?.subscription_details?.subscription ?? invoice.subscription
  return typeof value === 'string' ? value : value?.id
}
async function main() {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('client_packs')
      .select('id,purchase_date,installment_count,paid_installments,payment_status,stripe_subscription_id,stripe_subscription_schedule_id,client:clients(email)')
      .not('stripe_subscription_id', 'is', null).order('id').range(offset, offset + 499)
    if (error) throw error
    rows.push(...data)
    if (data.length < 500) break
  }
  const report = []
  for (const row of rows) {
    const flags = []
    if (!row.stripe_subscription_schedule_id) flags.push('NO_RECORDED_FINITE_SCHEDULE')
    const anniversary = new Date(row.purchase_date)
    const day = anniversary.getUTCDate()
    anniversary.setUTCDate(1)
    anniversary.setUTCMonth(anniversary.getUTCMonth() + row.installment_count - 1)
    anniversary.setUTCDate(Math.min(day, new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate()))
    if (anniversary <= new Date() && row.paid_installments < row.installment_count) flags.push('COUNTER_BEHIND_EXPECTED_CALENDAR_REQUIRES_CHECK')
    const result = { ...row, flags, stripeVerified: false }
    if (stripe) {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
      const invoices = []
      for await (const invoice of stripe.invoices.list({ subscription: sub.id, status: 'paid', limit: 100 })) {
        if (subscriptionId(invoice) === sub.id && invoice.amount_paid > 0 && ['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason)) invoices.push(invoice)
      }
      invoices.sort((a, b) => a.created - b.created)
      Object.assign(result, { stripeVerified: true, stripeStatus: sub.status, cancelAt: sub.cancel_at, cancelAtPeriodEnd: sub.cancel_at_period_end, stripePaidInvoices: invoices.map(i => ({ id: i.id, date: new Date(i.created * 1000).toISOString(), amountCents: i.amount_paid, currency: i.currency, subscriptionId: sub.id })) })
      if (invoices.length > row.installment_count) flags.push('OVERPAYMENT_REQUIRES_REFUND_REVIEW')
      if (invoices.length >= row.installment_count && !['canceled', 'incomplete_expired'].includes(sub.status) && !sub.cancel_at_period_end && !sub.cancel_at) flags.push('PAID_PLAN_STILL_RENEWING')
      if (row.paid_installments !== Math.min(row.installment_count, invoices.length)) flags.push('STRIPE_COUNTER_MISMATCH')
    }
    report.push(result)
  }
  console.log(JSON.stringify({ readOnly: true, stripeConfigured: Boolean(stripe), subscriptionCount: rows.length, report }, null, 2))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
