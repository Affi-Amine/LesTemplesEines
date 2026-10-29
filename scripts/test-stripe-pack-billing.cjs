const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict')
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/stripe-pack-billing.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: mod.exports, Date, Map, console: { error() {} }, require(name) {
    if (name === '@/lib/packs') return { getPackPaymentStatus: (count, paid) => paid >= count ? 'paid' : paid ? 'partially_paid' : 'pending' }
    throw new Error(name)
  },
})
const { getInvoiceSubscriptionId, getPackBillingEnd, getPaidPackInvoices, protectPackSubscription, reconcilePackBilling } = mod.exports
const id = 'sub_test', anchor = Math.floor(Date.parse('2099-08-12T17:03:13Z') / 1000)
const invoice = (n, overrides = {}) => ({ id: 'in_' + n, parent: { subscription_details: { subscription: id } }, amount_paid: 10000, status: 'paid', billing_reason: 'subscription_cycle', ...overrides })
function fixture({ invoices = [invoice(1), invoice(2)], sub = {}, pages, dbError, stripeError } = {}) {
  const state = { id: 'pack', installment_count: 2, paid_installments: 1, payment_status: 'partially_paid', stripe_subscription_id: id }
  const subscription = { id, billing_cycle_anchor: anchor, status: 'active', cancel_at_period_end: false, cancel_at: null, ...sub }
  const updates = [], writes = [], listCalls = []
  const stripe = {
    subscriptions: { retrieve: async () => subscription, update: async (key, data) => { updates.push({ key, data }); if (stripeError) throw new Error('Stripe unavailable'); Object.assign(subscription, data); return subscription } },
    invoices: { list: async args => { listCalls.push(args); return pages ? pages[args.starting_after ? 1 : 0] : { data: invoices, has_more: false } } },
    subscriptionSchedules: { retrieve: async () => ({ end_behavior: 'release', phases: [] }) },
  }
  const db = { from(table) { assert.equal(table, 'client_packs'); return { update(data) { return { eq(field, value) { assert.equal(field, 'id'); assert.equal(value, state.id); return { async lte(field, limit) { assert.equal(field, 'paid_installments'); if (dbError) return { error: new Error('Database unavailable') }; if (state.paid_installments <= limit) { writes.push(data); Object.assign(state, data) }; return { error: null } } } } } } } } }
  return { stripe, db, state, subscription, updates, writes, listCalls }
}
async function main() {
  assert.equal(getInvoiceSubscriptionId({ subscription: id }), id)
  assert.equal(getInvoiceSubscriptionId({ subscription: { id } }), id)
  assert.equal(getInvoiceSubscriptionId(invoice(1)), id)
  assert.equal(getInvoiceSubscriptionId({ parent: { subscription_details: { subscription: { id } } } }), id)
  assert.equal(getInvoiceSubscriptionId({}), null)
  assert.equal(new Date(getPackBillingEnd(anchor, 2) * 1000).toISOString(), '2099-10-12T17:03:13.000Z')
  assert.equal(new Date(getPackBillingEnd(Date.parse('2027-12-31T10:30Z') / 1000, 2) * 1000).toISOString(), '2028-02-29T10:30:00.000Z')
  assert.equal(new Date(getPackBillingEnd(Date.parse('2026-08-31T10:30Z') / 1000, 3) * 1000).toISOString(), '2026-11-30T10:30:00.000Z')
  console.log('PASS: legacy/modern/expanded subscription references; fixed monthly cutoff including leap years')

  let f = fixture()
  await reconcilePackBilling(f.stripe, f.db, f.state, invoice(2))
  assert.equal(f.state.paid_installments, 2); assert.equal(f.state.payment_status, 'paid')
  assert(f.updates.some(x => x.data.cancel_at === getPackBillingEnd(anchor, 2)))
  assert.equal(f.subscription.cancel_at, getPackBillingEnd(anchor, 2))
  await reconcilePackBilling(f.stripe, f.db, f.state, invoice(2))
  assert.equal(f.state.paid_installments, 2)
  assert(!f.updates.some(x => x.data.cancel_at_period_end === false))
  console.log('PASS: second paid invoice stops renewals; repeated webhooks cannot count a third installment or reopen the subscription')

  f = fixture({ invoices: [invoice(1), invoice(2), invoice(3)] })
  let result = await reconcilePackBilling(f.stripe, f.db, f.state)
  assert.equal(result.invoiceCount, 3); assert.equal(f.state.paid_installments, 2); assert(f.subscription.cancel_at)
  f = fixture({ invoices: [invoice(1)] }); f.state.installment_count = 3
  await reconcilePackBilling(f.stripe, f.db, f.state)
  assert.equal(f.subscription.cancel_at, getPackBillingEnd(anchor, 3)); assert.equal(f.subscription.cancel_at_period_end, false)
  console.log('PASS: third excess invoice flagged; three-part plan retains its legitimate remaining payments')

  f = fixture({ pages: [{ data: [invoice(1)], has_more: true }, { data: [invoice(2)], has_more: false }] })
  assert.equal((await getPaidPackInvoices(f.stripe, id, invoice(2))).length, 2)
  assert.equal(f.listCalls[1].starting_after, 'in_1')
  f = fixture({ invoices: [invoice(1), invoice(3, { amount_paid: 0 }), invoice(4, { billing_reason: 'manual' })] })
  assert.equal((await getPaidPackInvoices(f.stripe, id, invoice(2))).length, 2)
  f.state.paid_installments = 2; f.state.payment_status = 'paid'
  await reconcilePackBilling(f.stripe, f.db, f.state)
  assert.equal(f.state.paid_installments, 2); assert.equal(f.state.payment_status, 'paid')
  console.log('PASS: all invoice pages read; event/list duplicates, zero invoices, manual invoices and stale events cannot corrupt counters')

  f = fixture({ sub: { status: 'canceled' } }); await reconcilePackBilling(f.stripe, f.db, f.state); assert.equal(f.updates.length, 0)
  f = fixture({ sub: { cancel_at_period_end: true } }); await protectPackSubscription(f.stripe, id, 2); assert.equal(f.updates.length, 0)
  f = fixture({ sub: { cancel_at: anchor + 3600 } }); await protectPackSubscription(f.stripe, id, 2); assert.equal(f.updates.length, 0)
  f = fixture({ sub: { schedule: 'sched_test' } }); await assert.rejects(() => protectPackSubscription(f.stripe, id, 2), /review/)
  f = fixture({ stripeError: true }); await assert.rejects(() => reconcilePackBilling(f.stripe, f.db, f.state)); assert.equal(f.writes.length, 0)
  f = fixture({ dbError: true }); await assert.rejects(() => reconcilePackBilling(f.stripe, f.db, f.state)); assert(f.subscription.cancel_at)
  f = fixture({ sub: { billing_cycle_anchor: Date.parse('2026-08-12T17:03:13Z') / 1000 } }); await protectPackSubscription(f.stripe, id, 2); assert(f.subscription.cancel_at_period_end)
  f = fixture(); f.state.payment_status = 'cancelled'; await reconcilePackBilling(f.stripe, f.db, f.state); assert.equal(f.state.payment_status, 'cancelled')
  f = fixture({ invoices: [invoice(1)], sub: { status: 'past_due' } }); result = await reconcilePackBilling(f.stripe, f.db, f.state); assert.equal(result.paymentStatus, 'failed')
  console.log('PASS: canceled/earlier-stopped plans preserved; unmanaged schedules fail closed; Stripe/DB failures surface; existing overdue plans stop renewing')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
