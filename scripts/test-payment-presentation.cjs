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
assert.match(colour({status:'confirmed',payment_status:'paid'}), /bg-emerald-100/)
for (const status of ['unpaid','pending','failed','partial',undefined]) {
  assert.match(colour({status:'confirmed',payment_status:status}), /bg-rose-100/)
}
for (const status of ['in_progress','completed','cancelled','no_show','blocked']) {
  assert.equal(colour({status,payment_status:'paid'}), utils.getStatusColor(status))
  assert.equal(colour({status,payment_status:'unpaid'}), utils.getStatusColor(status))
}
assert.equal(colour({status:'in_progress',payment_status:'paid'}), colour({status:'completed',payment_status:'paid'}))
assert.match(colour({status:'completed',payment_status:'paid'}), /bg-blue-100/)
console.log('PASS: paid / unpaid cards differ; care progress overrides payment colour without changing its state')

const paletteCSS = fs.readFileSync('app/appointment-colors.css', 'utf8')
const luminance = hex => hex.match(/\w\w/g).map(pair => parseInt(pair, 16) / 255)
  .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
for (const tone of ['blue', 'green', 'red', 'blocked']) {
  const block = paletteCSS.match(new RegExp(`\\.appointment-tone-${tone} \\{([^}]+)\\}`))[1]
  const background = block.match(/--appointment-bg: #([\da-f]{6})/)[1]
  const text = block.match(/--appointment-ink: #([\da-f]{6})/)[1]
  const ratio = (luminance(background) + 0.05) / (luminance(text) + 0.05)
  assert.ok(ratio >= 4.5, `${tone} contrast ${ratio.toFixed(2)} is too low`)
}
assert.match(paletteCSS, /color-scheme:\s*only light/)
console.log('PASS: every pastel surface has readable text contrast and opts out of automatic darkening')
