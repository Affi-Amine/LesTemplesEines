const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict')
const id = '00000000-0000-4000-8000-000000000001'
const payload = { pack_id: id, installment_count: 2, customer_email: 'test@example.com', customer_first_name: 'Test', customer_last_name: 'Client', customer_phone: '0600000000' }
function load(file, mocks) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: mod.exports, Date, crypto: require('node:crypto').webcrypto, console: { log() {}, error() {} }, require(name) {
      if (name in mocks) return mocks[name]
      if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } }
      if (name.startsWith('@/')) return {}
      return require(name)
    },
  })
  return mod.exports
}
async function main() {
  let called = 0
  const purchase = load('app/api/packs/purchase/route.ts', {
    '@/lib/packs': { PackPurchaseSchema: { parse: v => v } },
    '@/lib/supabase/admin': { createAdminClient() { called++; throw new Error('Must not access database') } },
    '@/lib/stripe': { getStripeClient() { called++; throw new Error('Must not create subscription') } },
  })
  for (const count of [2, 3]) {
    const result = await purchase.POST({ json: async () => ({ ...payload, installment_count: count }) })
    assert.equal(result.status, 503)
  }
  assert.equal(called, 0)
  console.log('PASS: both installment purchase routes fail closed before account creation, database or Stripe calls')

  let checkoutParams, storedCheckout
  const singlePurchase = load('app/api/packs/purchase/route.ts', {
    '@/lib/packs': { PackPurchaseSchema: { parse: v => v }, eurosToCents: x => Math.round(x * 100), getInstallmentAmounts: x => [x] },
    '@/lib/client-auth': { findClientByEmail: async () => ({ auth_user_id: id }), findAuthUserByEmail: async () => ({ id }) },
    '@/lib/gift-cards': { getBaseUrl: () => 'https://example.com' },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from(table) { const q = { select() { return q }, eq() { return q }, async single() { return { data: { id, name: 'Forfait', price: 200, number_of_sessions: 3, allowed_installments: [1, 2] }, error: null } }, async insert(data) { storedCheckout = data[0]; return { error: null } } }; return q } }) },
    '@/lib/stripe': { getStripeClient: () => ({ checkout: { sessions: { async create(params) { checkoutParams = params; return { id: 'cs_single', url: 'https://checkout.stripe.com/test' } } } } }) },
  })
  const single = await singlePurchase.POST({ json: async () => ({ ...payload, installment_count: 1 }), nextUrl: { origin: 'https://example.com' } })
  assert.equal(single.status, 200); assert.equal(checkoutParams.mode, 'payment'); assert.equal(checkoutParams.line_items[0].price_data.unit_amount, 20000)
  assert.equal(checkoutParams.line_items[0].price_data.recurring, undefined); assert.equal(storedCheckout.payload.installment_count, 1)
  console.log('PASS: legitimate one-time pack purchase remains available and creates no recurring subscription')

  async function webhook(type, { modern = true, databaseError = false, reconcileError = false, invalidSignature = false, checkoutError = false } = {}) {
    let reconciles = 0, selectedId, markedFailed = false
    const invoice = { id: 'in_test', status: 'paid', ...(modern ? { parent: { subscription_details: { subscription: 'sub_test' } } } : { subscription: 'sub_test' }) }
    const event = { type, data: { object: type === 'checkout.session.completed' ? { id: 'cs_test', payment_status: 'paid' } : invoice } }
    const db = { from(table) {
      let updating = false
      const q = {
        select() { return q },
        eq(field, value) { if (field === 'stripe_subscription_id') selectedId = value; return q },
        update(data) { updating = true; if (data.status === 'failed') markedFailed = true; return q },
        async maybeSingle() {
          if (table === 'stripe_checkout_sessions') return { data: { status: 'open', checkout_type: 'pack', payload: {} }, error: null }
          return { data: checkoutError ? null : { id, stripe_subscription_id: 'sub_test', installment_count: 2 }, error: databaseError ? new Error('Database down') : null }
        },
        then(resolve) { return Promise.resolve({ error: null }).then(resolve) },
      }
      return q
    } }
    const route = load('app/api/stripe/webhook/route.ts', {
      '@/lib/supabase/admin': { createAdminClient: () => db },
      '@/lib/stripe': { stripeWebhookSecret: 'test', getStripeClient: () => ({ webhooks: { constructEvent() { if (invalidSignature) throw new Error('Bad signature'); return event } } }) },
      '@/lib/stripe-pack-billing': {
        getInvoiceSubscriptionId: x => x.parent?.subscription_details?.subscription || x.subscription,
        reconcilePackBilling: async () => { reconciles++; if (reconcileError) throw new Error('Stripe unavailable'); return { paid: 2, paymentStatus: 'paid' } },
      },
    })
    const result = await route.POST({ headers: { get: () => 'signature' }, text: async () => 'event' })
    return { result, reconciles, selectedId, markedFailed }
  }
  for (const modern of [true, false]) {
    const x = await webhook('invoice.paid', { modern })
    assert.equal(x.result.status, 200); assert.equal(x.selectedId, 'sub_test'); assert.equal(x.reconciles, 1)
  }
  assert.equal((await webhook('invoice.paid', { databaseError: true })).result.status, 500)
  assert.equal((await webhook('invoice.paid', { reconcileError: true })).result.status, 500)
  assert.equal((await webhook('invoice.paid', { invalidSignature: true })).result.status, 400)
  const failed = await webhook('checkout.session.completed', { checkoutError: true })
  assert.equal(failed.result.status, 500); assert(failed.markedFailed)
  const lateFailure = await webhook('invoice.payment_failed')
  assert.equal(lateFailure.result.status, 200); assert.equal(lateFailure.reconciles, 1)
  console.log('PASS: actual webhook route handles modern and legacy invoices; transient DB/Stripe/checkout errors return 500 for retry; invalid signatures return 400; late failure rechecks payment state')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
