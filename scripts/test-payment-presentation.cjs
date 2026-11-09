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
const attendanceColours = {
  confirmed:'appointment-tone-blue', pending:'appointment-tone-blue',
  in_progress:'appointment-tone-green', completed:'appointment-tone-green',
  cancelled:'appointment-tone-red', no_show:'appointment-tone-red', blocked:'appointment-tone-blocked',
}
for (const [status, tone] of Object.entries(attendanceColours)) {
  const expected = utils.getStatusColor(status)
  assert.ok(expected.split(' ').includes(tone), `${status} must use ${tone}`)
  for (const payment_status of ['paid','unpaid','pending','failed','partial',null,undefined]) {
    for (const start_time of ['2000-01-01T10:00:00Z','2100-01-01T10:00:00Z']) {
      assert.equal(colour({status,payment_status,start_time}), expected,
        `${status} attendance colour must not depend on payment or appointment date`)
    }
  }
}
assert.equal(colour({status:'confirmed'}), colour({status:'pending'}))
assert.equal(colour({status:'in_progress'}), colour({status:'completed'}))
assert.equal(colour({status:'unexpected'}), utils.getStatusColor('blocked'))
console.log('PASS: attendance alone colours cards; payment and elapsed time never imply arrival or absence')

// Older deployments stored an eight-tone service colour. Its API contract remains
// valid, while those tones must never change an appointment's attendance colour.
const legacyColorMigration = fs.readFileSync('database/migrations/2026-11-06_service_color.sql','utf8')
for (const legacyTone of utils.SERVICE_TONES) {
  assert(utils.isServiceTone(legacyTone))
  assert(utils.SERVICE_TONE_LABELS[legacyTone])
  assert(legacyColorMigration.includes(`'${legacyTone}'`))
  for (const status of Object.keys(attendanceColours)) {
    assert.equal(colour({status,payment_status:'paid',service:{color:legacyTone}}),utils.getStatusColor(status))
  }
}

// Render the real marker and legend so glyphs, labels and booking-source codes
// stay consistent across the compact planning and the detailed payment badge.
const path = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { Check, X } = require('lucide-react')
const renderedModules = new Map()
function loadTSX(file) {
  const filename = path.resolve(file)
  if (renderedModules.has(filename)) return renderedModules.get(filename).exports
  const loaded = { exports:{} }
  renderedModules.set(filename, loaded)
  const localRequire = name => {
    if (!name.startsWith('@/')) return require(name)
    const target = name.slice(2)
    const resolved = ['.tsx','.ts'].map(extension => target + extension).find(candidate => fs.existsSync(candidate))
    if (!resolved) throw new Error(`Cannot resolve test module ${name}`)
    return loadTSX(resolved)
  }
  const compiled = ts.transpileModule(fs.readFileSync(filename,'utf8'), {
    fileName:filename,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},
  }).outputText
  vm.runInNewContext(compiled, {exports:loaded.exports,module:loaded,require:localRequire}, {filename})
  return loaded.exports
}
const { AppointmentPaymentMarker } = loadTSX('components/calendar/appointment-payment-marker.tsx')
const { AppointmentPaymentBadge, AppointmentPaymentLegend } = loadTSX('components/appointment-payment-badge.tsx')
const { AppointmentStaffChoiceMarker } = loadTSX('components/calendar/appointment-staff-choice-marker.tsx')
const { AppointmentCardContent } = loadTSX('components/calendar/appointment-card-content.tsx')
const { AppointmentServiceStars } = loadTSX('components/calendar/appointment-service-stars.tsx')
const { SERVICE_PLANNING_COLORS } = loadTSX('lib/services/planning-colors.ts')
const render = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component,props))
const visibleText = html => html.replace(/<[^>]*>/g,'')
const svgGeometry = html => [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)]
  .map(([svg]) => [...svg.matchAll(/<(?:path|line|polyline)\b[^>]*>/g)].map(([shape]) => shape))
const paidGlyph = svgGeometry(render(Check))
const unpaidGlyph = svgGeometry(render(X))
for (const Component of [AppointmentPaymentMarker,AppointmentPaymentBadge]) {
  for (const payment_status of ['paid','unpaid','partial','failed','pending','unknown',null,undefined]) {
    const appointment = {status:'confirmed',payment_status,payment_method:'cash'}
    const html = render(Component,{appointment})
    assert.deepEqual(svgGeometry(html), payment_status === 'paid' ? paidGlyph : unpaidGlyph,
      `${Component.name}: only fully paid appointments get a check; all outstanding payments get a cross`)
    assert.ok(html.includes(`aria-label="${present(appointment).label}"`),
      `${Component.name}: the payment meaning must be available without recognising the glyph`)
  }
  assert.equal(render(Component,{appointment:{status:'blocked',payment_status:'paid'}}),'',
    `${Component.name}: blocked slots must not acquire payment markers`)
}
for (const payment_status of ['paid','unpaid','partial','failed','pending','unknown',undefined]) {
  const html = render(AppointmentPaymentMarker,{appointment:{payment_status,payment_method:'stripe'}})
  assert.equal(visibleText(html).includes('L'),payment_status === 'paid','L means paid online, never an attempted payment')
}
for (const [source,code,label] of [['planity','P','Planity'],['treatwell','T','Treatwell']]) {
  const appointment = {source,payment_status:'unpaid'}
  const html = render(AppointmentPaymentMarker,{appointment})
  assert.equal(visibleText(html),code,`${label} remains visible even before payment`)
  assert.ok(html.includes('role="img"'),'The icon group has a role that supports an accessible name')
  assert.ok(html.includes(`aria-label="${present(appointment).label} · Réservé sur ${label}"`),
    `${label} source and payment are announced together`)
  assert.deepEqual(svgGeometry(html),unpaidGlyph)
}
const onlinePlanity = render(AppointmentPaymentMarker,{appointment:{source:'planity',payment_status:'paid',payment_method:'stripe'}})
assert.equal(visibleText(onlinePlanity),'LP','A paid online booking can also retain its booking-source code')
assert.ok(onlinePlanity.includes('aria-label="Payé en ligne · Réservé sur Planity"'))
for (const [payment_method,code,label] of [['gift_card','C','Réglé par carte cadeau'],['pack','F','Réglé par forfait'],['treatwell','T','Payé via Treatwell']]) {
  const html = render(AppointmentPaymentMarker,{appointment:{payment_method,payment_status:'paid'}})
  assert.equal(visibleText(html),code)
  assert.ok(html.includes(`aria-label="${label}"`))
  assert.deepEqual(svgGeometry(html),paidGlyph)
  assert.equal(visibleText(render(AppointmentPaymentMarker,{appointment:{payment_method,payment_status:'partial'}})),'',
    `${code} must not imply a gift card, forfait or platform has settled a partial payment`)
}
const treatwellOnce = render(AppointmentPaymentMarker,{appointment:{source:'treatwell',payment_method:'treatwell',payment_status:'paid'}})
assert.equal(visibleText(treatwellOnce),'T','Treatwell source and payment must not duplicate T')
for (const payment_method of ['card','cash','check','on_site','loyalty','mixed',undefined]) {
  const html = render(AppointmentPaymentMarker,{appointment:{payment_method,payment_status:'paid'}})
  assert.equal(visibleText(html),'','Other settled payments use the check without introducing S or another code')
  assert.deepEqual(svgGeometry(html),paidGlyph)
}
const legend = render(AppointmentPaymentLegend)
assert.ok(legend.includes('aria-label="Légende du planning"'))
for (const text of ['Attendu','Venu','Absent','Annulé','Bloqué','Payé','À payer, même partiel','L','Payé en ligne','T','Treatwell','P','Planity','F','Forfait','C','Carte cadeau','×2','Duo','Masseuse choisie par le client']) {
  assert.ok(visibleText(legend).includes(text),`Legend must explain ${text}`)
}
assert.doesNotMatch(legend,/<(?:details|summary)\b|<[^>]+\shidden(?=[\s=>])|\bclass="[^"]*\b(?:sr-only|hidden)\b|display:\s*none/,
  'The compact legend must be visible immediately rather than behind an expandable control')
console.log('PASS: rendered payment checks/crosses, L/T/P/F/C codes and visible legend convey their meaning accessibly')

const chosenId = '00000000-0000-4000-8000-000000000001'
for (const value of [undefined,null,[],[''],['not-an-id'],true,'true']) {
  assert.equal(render(AppointmentStaffChoiceMarker,{appointment:{status:'confirmed',staff_id:chosenId,client_requested_staff_ids:value}}),'',
    'An assignment or malformed preference must never create a client-choice lock')
}
const chosen = {status:'confirmed',client_requested_staff_ids:[chosenId],staff_id:'00000000-0000-4000-8000-000000000002'}
const lockHTML = render(AppointmentStaffChoiceMarker,{appointment:chosen})
assert.ok(lockHTML.includes('role="img"') && lockHTML.includes('aria-label="Masseuse choisie par le client"'))
assert.ok(lockHTML.includes('<svg'), 'Client choice must have a real visible lock icon')
assert.equal(render(AppointmentStaffChoiceMarker,{appointment:{...chosen,status:'blocked'}}),'')
for (const height of [22,46,94,160]) {
  const html = render(AppointmentCardContent,{appointment:{...chosen,start_time:'2099-11-02T09:00Z',end_time:'2099-11-02T10:00Z',payment_status:'paid',payment_method:'stripe'},height})
  assert.equal((html.match(/data-client-staff-choice/g)||[]).length,1,`The lock must be present on a ${height}px appointment card`)
}
console.log('PASS: only recorded client preferences show an accessible lock, including short cards and after administrative reassignment')

assert.equal(SERVICE_PLANNING_COLORS.length,12)
assert.equal(new Set(SERVICE_PLANNING_COLORS.map(color=>color.hex.toLowerCase())).size,12)
const existingMarkerColors = fs.readFileSync('app/appointment-colors.css','utf8').match(/#[\da-f]{6}/gi).map(hex=>hex.toLowerCase())
for (const color of SERVICE_PLANNING_COLORS) {
  assert(!existingMarkerColors.includes(color.hex.toLowerCase()),`${color.label} must not reuse an existing status/payment/source colour`)
  const html = render(AppointmentServiceStars,{appointment:{planning_services:[{id:'service-a',name:'Massage détente',planning_color:color.id}]}})
  assert.ok(html.includes(`fill="${color.hex}"`))
  assert.ok(html.includes(`aria-label="Massage détente · ${color.label}"`))
}
for (const color of [null,undefined,'unknown','#ff0000']) {
  assert.equal(render(AppointmentServiceStars,{appointment:{service:{id:'service-a',name:'Massage',planning_color:color}}}),'')
}
const multiple = {planning_services:[{id:'a',name:'Soin historique A',planning_color:'cyan'},{id:'b',name:'Soin historique B',planning_color:'coral'}]}
const starHTML = render(AppointmentServiceStars,{appointment:multiple})
assert.equal((starHTML.match(/data-service-color-star=/g)||[]).length,2,'Each prestation in a combined booking keeps its own star')
assert(starHTML.includes('Soin historique A · Cyan') && starHTML.includes('Soin historique B · Corail'))
assert.equal(render(AppointmentServiceStars,{appointment:{...multiple,status:'blocked'}}),'')
const removed = {...multiple,planning_services:multiple.planning_services.map(service=>({...service,planning_color:null})),service:{id:'a',planning_color:'cyan'}}
assert.equal(render(AppointmentServiceStars,{appointment:removed}),'','A removed current catalogue colour must not come back from an old fallback')
console.log('PASS: twelve distinct service stars have accessible names, multi-service bookings show each colour, and unconfigured/blocked bookings remain unmarked')

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
