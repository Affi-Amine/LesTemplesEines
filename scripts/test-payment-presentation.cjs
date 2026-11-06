const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/appointments/payment-presentation.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,{exports:exportsObject})
const present=exportsObject.getAppointmentPayment
for(const method of ['card','cash','check','on_site']) {
  const result=present({payment_status:'paid',payment_method:method})
  assert.equal(result.channel,'on-site'); assert.equal(result.icon,'check'); assert.equal(result.label,'Payé sur place')
}
assert.equal(present({payment_status:'paid',payment_method:'stripe'}).label,'Payé en ligne')
for(const status of ['unpaid','pending','failed','partial',undefined]) {
  for(const method of ['stripe','card','cash',undefined]) {
    assert.notEqual(present({payment_status:status,payment_method:method}).icon,'check')
  }
}
assert.equal(present({status:'blocked',payment_status:'paid'}),null)
assert.equal(present({payment_status:'paid',payment_method:'gift_card'}).label,'Réglé par carte cadeau')
assert.equal(present({payment_status:'paid',payment_method:'pack'}).label,'Réglé par forfait')
assert.equal(present({payment_status:'paid'}).channel,'unknown')
assert.equal(present({payment_status:'paid',payment_method:'mixed'}).channel,'mixed')
assert.equal(present({status:'completed',payment_status:'unpaid'}).state,'unpaid')
assert.equal(present({status:'confirmed',payment_method:'stripe',payment_status:'pending'}).state,'pending')
console.log('PASS: payment checks require paid status; online, on-site, gift card, pack, mixed and unpaid states stay distinct')

const utils = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/utils.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,{exports:utils,require})
const colour = utils.getAppointmentColor
// A booked card is coloured by its prestation; the payment moved to its left edge.
const thai = { status: 'confirmed', service_id: 'thai-60' }
const tone = value => value.match(/appointment-tone-(\w+)/)[1]
assert.match(colour({ ...thai, payment_status: 'paid' }), /appointment-pay-paid/)
assert.match(colour({ ...thai, payment_status: 'partial' }), /appointment-pay-partial/)
for (const status of ['unpaid', 'pending', 'failed', undefined]) {
  assert.match(colour({ ...thai, payment_status: status }), /appointment-pay-unpaid/)
}
// Same prestation, same tone whatever the payment or where its id sits.
assert.equal(tone(colour({ ...thai, payment_status: 'paid' })), tone(colour({ ...thai, payment_status: 'unpaid' })))
assert.equal(tone(colour({ status: 'confirmed', service: { id: 'thai-60' } })), tone(colour(thai)))
assert.equal(tone(colour({ status: 'confirmed', service: { name: 'Massage' } })), utils.getServiceTone('Massage'))
assert.ok(utils.SERVICE_TONES.includes(tone(colour(thai))))
assert.notEqual(tone(colour(thai)), tone(colour({ status: 'confirmed', service_id: 'thai-90' })), 'two prestations are told apart')
// A booking with no prestation at all must still render a known tone.
assert.ok(utils.SERVICE_TONES.includes(tone(colour({ status: 'confirmed' }))))
// A colour chosen on the prestation wins over the one derived from its id.
assert.equal(tone(colour({ status: 'confirmed', service_id: 'thai-60', service: { id: 'thai-60', color: 'rose' } })), 'rose')
assert.equal(tone(colour({ status: 'confirmed', service: { name: 'Massage', color: 'lime' } })), 'lime')
// A colour that is not in the palette is ignored rather than rendered as a broken class.
for (const bogus of ['#ff0000', 'fuchsia', '', null, 42]) {
  const value = tone(colour({ status: 'confirmed', service_id: 'thai-60', service: { id: 'thai-60', color: bogus } }))
  assert.equal(value, tone(colour({ status: 'confirmed', service_id: 'thai-60' })), `bogus colour ${bogus} must fall back`)
}
// Every tone offered to the salon exists in the palette and in the database constraint.
const migration = fs.readFileSync('database/migrations/2026-11-06_service_color.sql', 'utf8')
const palette = fs.readFileSync('app/appointment-colors.css', 'utf8')
for (const serviceTone of utils.SERVICE_TONES) {
  assert.match(palette, new RegExp(`\\.appointment-tone-${serviceTone} \\{`), `${serviceTone} missing from the palette`)
  assert.ok(migration.includes(`'${serviceTone}'`), `${serviceTone} missing from the colour constraint`)
  assert.ok(utils.SERVICE_TONE_LABELS[serviceTone], `${serviceTone} has no label`)
}
const spread = new Set(['thai-60', 'thai-90', 'gommage', 'reflexo', 'duo', 'sauna', 'hammam', 'dos']
  .map(id => tone(colour({ status: 'confirmed', service_id: id }))))
assert.ok(spread.size >= 4, `the palette spreads prestations across colours, got ${spread.size}`)
for (const status of ['in_progress','completed','cancelled','no_show','blocked']) {
  assert.equal(colour({status,payment_status:'paid'}), utils.getStatusColor(status))
  assert.equal(colour({status,payment_status:'unpaid'}), utils.getStatusColor(status))
}
assert.equal(colour({status:'in_progress',payment_status:'paid'}), colour({status:'completed',payment_status:'paid'}))
assert.match(colour({status:'completed',payment_status:'paid'}), /bg-blue-100/)
console.log('PASS: the card colour follows the prestation, the payment its left edge, and care progress still overrides both')

const paletteCSS = fs.readFileSync('app/appointment-colors.css', 'utf8')
const luminance = hex => hex.match(/\w\w/g).map(pair => parseInt(pair, 16) / 255)
  .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
for (const tone of ['blue', 'green', 'red', 'blocked', 'amber', 'violet', 'teal', 'sky', 'rose', 'lime']) {
  const block = paletteCSS.match(new RegExp(`\\.appointment-tone-${tone} \\{([^}]+)\\}`))[1]
  const background = block.match(/--appointment-bg: #([\da-f]{6})/)[1]
  const text = block.match(/--appointment-ink: #([\da-f]{6})/)[1]
  const ratio = (luminance(background) + 0.05) / (luminance(text) + 0.05)
  assert.ok(ratio >= 4.5, `${tone} contrast ${ratio.toFixed(2)} is too low`)
}
assert.match(paletteCSS, /color-scheme:\s*only light/)
console.log('PASS: every pastel surface has readable text contrast and opts out of automatic darkening')

// ---- what the till asks for -------------------------------------------------
// The checkout dialog is the single money path of the agenda; its arithmetic
// decides what the front desk is told to collect.
const checkoutSource = fs.readFileSync('components/calendar/appointment-checkout-dialog.tsx', 'utf8')
  // Keep only the two exported helpers: the rest is React and not needed here.
  .split('export function AppointmentCheckoutDialog')[0]
  .replace(/^import[\s\S]*?$/gm, '')
const checkout = {}
vm.runInNewContext(ts.transpileModule(checkoutSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.None },
}).outputText, { exports: checkout })
const { alreadyPaidCents, amountDueCents } = checkout

const booking = (overrides) => ({ service: { price_cents: 6500 }, ...overrides })
assert.equal(amountDueCents(booking({ payment_status: 'unpaid' })), 6500)
assert.equal(alreadyPaidCents(booking({ payment_status: 'unpaid', amount_paid_cents: 1000 })), 0,
  'only a partly paid booking carries a credit; a stale amount on an unpaid one is ignored')
// Prestation swapped for a dearer one: only the supplement is owed.
assert.equal(amountDueCents(booking({ payment_status: 'partial', amount_paid_cents: 3500 })), 3000)
assert.equal(alreadyPaidCents(booking({ payment_status: 'partial', amount_paid_cents: 3500 })), 3500)
// Swapped for a cheaper one: never ask for a negative amount.
assert.equal(amountDueCents(booking({ payment_status: 'partial', amount_paid_cents: 9000 })), 0)
// A booking imported without a price owes nothing rather than NaN.
assert.equal(amountDueCents({ payment_status: 'unpaid', service: null }), 0)
assert.equal(amountDueCents(null), 0)
console.log('PASS: the till asks for the full price, only the supplement when partly paid, and never a negative or NaN amount')
