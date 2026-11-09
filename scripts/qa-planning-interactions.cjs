const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
// Isolated local fixture regression: no user profile or real API writes.
// node scripts/qa-planning-interactions.cjs --url=http://127.0.0.1:3490
// Optional: --only=drop or --only=payment, --case=simple-card, and --resume.
// --only=phone checks first/last-column taps, immediate drag and payment on 390px.
const { origin, contextFor, time, id, salonId, day } = require('./qa-planning-fit.cjs')
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=') || true] }))
const outDir = path.resolve('output/playwright'), reportFile = path.join(outDir, 'qa-planning-interactions-results.json')
const captures = [], report = args.resume && fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : { origin, day, fixtureOnly: true, checks: [], failures: [] }
assert(report.origin === origin && report.day === day, 'Resume requires the same local origin and fixture day')
const roles = ['admin', 'manager', 'receptionist', 'assistant', 'therapist']
const card = (page, n = 1000) => page.locator(`[data-appointment-id="${id(n)}"]:visible`).first()
async function shot(page, name) { captures.push({ name: `${name}.png`, bytes: await page.screenshot({ animations: 'disabled' }) }) }
async function reveal(page, element) {
  const before = await element.boundingBox(), width = await page.evaluate(() => innerWidth)
  assert(before && before.x >= -1 && before.x + before.width <= width + 1, 'Card must already fit the phone/tablet width before tapping or moving')
  await element.evaluate(el => {
    const toolbar = document.querySelector('[data-agenda-toolbar]'); scrollBy({ left: 0, top: el.getBoundingClientRect().top - (toolbar?.getBoundingClientRect().bottom || 80) - 18 })
  })
  assert.equal(await page.evaluate(() => scrollX), 0, 'Interaction must never reveal a card by panning horizontally')
}
async function gesture(run, from, to, hold = false, beforeEnd) {
  const session = await run.context.newCDPSession(run.page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  if (hold) await run.page.waitForTimeout(300)
  for (let step = 1; step <= 14; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 14, y: from.y + (to.y - from.y) * step / 14 }] })
    await run.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
  }
  await beforeEnd?.()
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach()
}
async function setup(browser, { role = 'admin', width = 820, mode = 'success', payment = false, count = 2 } = {}) {
  const run = await contextFor(browser, width, count, role, width < 640 ? 844 : 1100), { state, context } = run
  state.readCount = 0; state.results = new Map(); state.mode = mode; state.initialRole = role
  if (payment) {
    const row = state.rows.find(row => row.id === id(2400))
    row.payment_status = payment.startsWith('partial') ? 'partial' : payment === 'already-paid' ? 'paid' : 'unpaid'
    row.amount_paid_cents = row.payment_status === 'partial' ? 6500 : row.payment_status === 'paid' ? 8000 : 0
    row.payment_method = row.payment_status === 'partial' || row.payment_status === 'paid' ? 'stripe' : null
    row.service_items = [{ id: id(10), name: 'Soin réservé QA', price_cents: 6000, duration_minutes: 45 }, { id: id(11), name: 'Supplément réservé QA', price_cents: 2000, duration_minutes: 15 }]
    row.service = { ...row.service, name: 'Nom actuel catalogue', price_cents: 10000 }
    row.total_price_cents = 8000
  }
  // Latest handler sees all API traffic first; GET falls back to the shared fixture.
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (method === 'GET') { if (url.pathname === '/api/appointments') state.readCount++; return route.fallback() }
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    const free = url.pathname.match(/^\/api\/admin\/salons\/([^/]+)\/appointments\/([^/]+)\/move$/)
    if ((free && method === 'POST') || (/^\/api\/appointments\//.test(url.pathname) && method === 'PATCH')) {
      const body = request.postDataJSON(), row = state.rows.find(row => row.id === (free ? free[2] : url.pathname.split('/').pop()))
      const record = { method, path: url.pathname, body }; state.mutations.push(record)
      const number = state.mutations.length
      if (state.results.has(body.request_id)) return reply(state.results.get(body.request_id))
      if (mode === 'server-error' && number === 1) return reply({ error: 'Erreur simulée QA, aucune modification appliquée.' }, 503)
      if (mode === 'network-before' && number === 1) return route.abort('failed')
      if (body.payment_status) {
        await new Promise(resolve => setTimeout(resolve, 180))
        Object.assign(row, { payment_status: body.payment_status, payment_method: body.payment_method, amount_paid_cents: body.amount_paid_cents, payments: body.payments })
      } else {
        const length = Date.parse(row.end_time) - Date.parse(row.start_time)
        row.start_time = body.start_time || row.start_time
        row.end_time = body.end_time || new Date(Date.parse(row.start_time) + length).toISOString()
        if (body.staff_ids) { row.staff_id = body.staff_ids[0]; row.staff = state.staff.find(member => member.id === row.staff_id); row.assignments = body.staff_ids.map(staff_id => ({ staff_id, staff: state.staff.find(member => member.id === staff_id) })) }
      }
      row.updated_at = new Date(Date.parse(row.updated_at) + 1000).toISOString()
      if (free) state.logs.push({ id: id(800 + state.logs.length), entity_id: row.id, changes: { source: 'salon_drag', request_id: body.request_id, actor: { name: `Staff ${role}` } } })
      const value = free ? { appointment: row, move_id: state.logs.at(-1).id, request_id: body.request_id, already_applied: false } : row
      if (body.request_id) state.results.set(body.request_id, structuredClone(value))
      if (mode === 'network-after' && number === 1) return route.abort('failed')
      return reply(value)
    }
    state.unexpected.push(`${method} ${url.pathname}`)
    return reply({ error: 'Unexpected write blocked by fixture' }, 500)
  })
  return run
}
async function openSalon(run) { await run.page.goto(`${origin}/admin/salons/${salonId}/dashboard?date=${day}`); await card(run.page).waitFor() }
async function drag(run) {
  const { page, state } = run
  await reveal(page, card(page))
  const source = await card(page).boundingBox(), target = await page.locator(`[data-calendar-slot="tablet-${id(20)}-11-0"]`).boundingBox(), before = state.mutations.length
  assert(source && target)
  await gesture(run, { x: source.x + source.width / 2, y: source.y + 8 }, { x: target.x + target.width / 2, y: target.y + 8 }, true, () => assert.equal(state.mutations.length, before, 'Move saved before drop'))
  assert.equal(await page.getByRole('heading', { name: 'Confirmer le déplacement', exact: true }).count(), 0, 'Drop still opens confirmation')
}
async function dropSuccess(browser, role, kind = 'salon', width = 820) {
  const run = await setup(browser, { role, width }), { page, state } = run
  try {
    if (kind === 'salon') await openSalon(run)
    else {
      await page.goto(`${origin}/admin/calendrier`)
      await page.getByRole('combobox', { name: 'Salon du planning', exact: true }).selectOption(salonId)
      await page.getByRole('button', { name: 'Jour suivant', exact: true }).click(); await card(page).waitFor()
    }
    const reads = state.readCount
    await drag(run)
    await page.getByText('Rendez-vous déplacé', { exact: true }).waitFor()
    assert.equal(state.mutations.length, 1, 'Drop should send exactly one request')
    assert.equal(state.mutations[0].method, kind === 'salon' ? 'POST' : 'PATCH')
    assert.equal(state.mutations[0].path, kind === 'salon' ? `/api/admin/salons/${salonId}/appointments/${id(1000)}/move` : `/api/appointments/${id(1000)}`)
    assert.equal(state.rows.find(row => row.id === id(1000)).start_time, time(11))
    assert.equal(state.logs.length, kind === 'salon' ? 1 : 0)
    assert(state.readCount > reads, 'Drop did not refresh appointments')
    assert.equal(await page.getByRole('dialog').count(), 0, 'Drop opened an unwanted dialog')
    assert.deepEqual(run.errors, []); assert.deepEqual(state.unexpected, [])
    if (role === 'therapist' || width < 640) await shot(page, `planning-drop-${role}-${width}`)
    return { scenario: 'drop-success', role, kind, width, requests: state.mutations, refresh: true, confirmation: false }
  } finally { await run.context.close() }
}
async function dropRetry(browser, mode) {
  const run = await setup(browser, { mode, role: 'assistant' }), { page, state } = run
  try {
    await openSalon(run); const reads = state.readCount
    await drag(run)
    await page.getByText('Résultat du déplacement à vérifier', { exact: true }).waitFor()
    assert.equal(state.mutations.length, 1)
    const first = structuredClone(state.mutations[0])
    assert.equal(state.rows.find(row => row.id === id(1000)).start_time, mode === 'network-after' ? time(11) : time(10))
    await shot(page, `planning-drop-retry-${mode}`)
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
    await page.getByText('Rendez-vous déplacé', { exact: true }).waitFor()
    assert.equal(state.mutations.length, 2)
    assert.deepEqual(state.mutations[1], first, 'Retry changed initial request ID/version/payload')
    assert.equal(state.logs.length, 1, 'Retry duplicated the journal entry')
    assert.equal(state.rows.find(row => row.id === id(1000)).start_time, time(11))
    assert(state.readCount >= reads + 2, 'Error/success did not reconcile appointments')
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.deepEqual(run.errors, []); assert.deepEqual(state.unexpected, [])
    return { scenario: 'drop-retry', mode, requests: state.mutations, logEntries: 1, initialRequestPreserved: true, refresh: true }
  } finally { await run.context.close() }
}
async function openCheckout(run) {
  const { page } = run
  await openSalon(run); const chosen = card(page, 2400); await reveal(page, chosen)
  const box = await chosen.boundingBox(); await page.touchscreen.tap(box.x + Math.min(30, box.width / 2), box.y + 28)
  const details = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Détails du rendez-vous/i }) }); await details.waitFor()
  await details.getByRole('button', { name: /^(Encaisser|Présent \/ payer)/ }).click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Encaisser le rendez-vous/ }) }); await dialog.waitFor()
  return dialog
}
async function paymentCase(browser, variant, width = 390) {
  const run = await setup(browser, { width, payment: variant }), { page, state } = run
  try {
    const dialog = await openCheckout(run), partial = variant.startsWith('partial'), due = partial ? 1500 : 8000
    const amount = await dialog.locator('[data-checkout-due]').innerText()
    assert(amount.includes(partial ? '15' : '80'), `Quoted remaining amount wrong: ${amount}`)
    assert((await dialog.innerText()).includes('Soin réservé QA') && (await dialog.innerText()).includes('Supplément réservé QA'), 'Checkout uses catalog name instead of booked care')
    if (partial) assert((await dialog.locator('[data-checkout-already-paid]').innerText()).includes('65,00'))
    if (variant.endsWith('cash')) await dialog.getByRole('button', { name: 'Espèces', exact: true }).click()
    else assert.equal(await dialog.getByRole('button', { name: 'Carte bancaire', exact: true }).getAttribute('aria-pressed'), 'true')
    if (variant.endsWith('mixed')) {
      await dialog.getByRole('button', { name: 'Paiement mixte ou autre moyen', exact: true }).click()
      await dialog.locator('input[id$="-amount-0"]').fill('10.001')
      assert(await confirmButton(dialog).isDisabled(), 'More than two decimals accepted')
      assert.equal(state.mutations.length, 0)
      await dialog.locator('input[id$="-amount-0"]').fill(partial ? '10,00' : '50,00')
      await dialog.getByRole('button', { name: /Ajouter.*moyen/ }).click()
      assert.equal(Number((await dialog.locator('input[id$="-amount-1"]').inputValue()).replace(',', '.')), partial ? 5 : 30)
      await dialog.locator('input[id$="-amount-1"]').fill(partial ? '10' : '50')
      assert(await confirmButton(dialog).isDisabled(), 'Overpayment accepted')
      assert((await dialog.locator('[data-checkout-error]').innerText()).includes('dépasse'))
      assert.equal(state.mutations.length, 0)
      await dialog.locator('input[id$="-amount-1"]').fill(partial ? '5,00' : '30,00')
    }
    const confirm = confirmButton(dialog)
    await shot(page, `planning-payment-${variant}-${width}`)
    await confirm.scrollIntoViewIfNeeded()
    const button = await confirm.boundingBox(); await page.mouse.dblclick(button.x + button.width / 2, button.y + button.height / 2, { delay: 15 })
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(state.mutations.length, 1, 'Payment double-tap sent duplicate requests')
    const request = state.mutations[0]
    assert.equal(request.method, 'PATCH'); assert.equal(request.path, `/api/appointments/${id(2400)}`)
    assert.equal(request.body.payment_status, 'paid'); assert.equal(request.body.amount_paid_cents, 8000)
    assert.equal(request.body.payments.reduce((total, line) => total + line.amount_cents, 0), due)
    assert.equal(request.body.payment_method, variant.endsWith('mixed') ? 'mixed' : variant.endsWith('cash') ? 'cash' : 'card')
    assert.equal(request.body.expected_updated_at, `${day}T06:00:00.000Z`)
    assert(!('status' in request.body), 'Checkout changed attendance')
    assert.equal(state.rows.find(row => row.id === id(2400)).status, 'confirmed')
    assert.deepEqual(run.errors, []); assert.deepEqual(state.unexpected, [])
    return { scenario: 'payment', variant, width, quoteCents: 8000, dueCents: due, requests: state.mutations, attendanceUnchanged: true }
  } catch (error) { await shot(page, `planning-payment-failure-${variant}-${width}`); throw error }
  finally { await run.context.close() }
}
const confirmButton = dialog => dialog.getByRole('button', { name: /^Valider.*encaissement/ })
async function alreadyPaidCase(browser) {
  const run = await setup(browser, { width: 390, payment: 'already-paid' }), { page, state } = run
  try {
    await openSalon(run); await reveal(page, card(page, 2400))
    const box = await card(page, 2400).boundingBox(); await page.touchscreen.tap(box.x + Math.min(30, box.width / 2), box.y + 28)
    const details = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Détails du rendez-vous/i }) }); await details.waitFor()
    assert.equal(await details.getByRole('button', { name: /^(Encaisser|Présent \/ payer)/ }).count(), 0)
    assert.equal(state.mutations.length, 0)
    return { scenario: 'payment-already-paid', noCheckoutAction: true, requests: [] }
  } finally { await run.context.close() }
}
async function paymentRetry(browser) {
  const run = await setup(browser, { width: 390, payment: 'simple-card', mode: 'server-error' }), { page, state } = run
  try {
    const dialog = await openCheckout(run)
    await confirmButton(dialog).click()
    await dialog.locator('[data-checkout-error]').waitFor()
    assert((await dialog.locator('[data-checkout-error]').innerText()).includes('Erreur simulée QA'))
    assert.equal(state.mutations.length, 1); assert.equal(state.rows.find(row => row.id === id(2400)).payment_status, 'unpaid')
    assert.equal(await dialog.getByRole('button', { name: 'Carte bancaire', exact: true }).getAttribute('aria-pressed'), 'true')
    await confirmButton(dialog).click(); await dialog.waitFor({ state: 'hidden' })
    assert.equal(state.mutations.length, 2); assert.deepEqual(state.mutations[1], state.mutations[0])
    assert.equal(state.rows.find(row => row.id === id(2400)).amount_paid_cents, 8000)
    assert.deepEqual(run.errors, []); assert.deepEqual(state.unexpected, [])
    return { scenario: 'payment-retry', requests: state.mutations, preservedMethodAndAmount: true }
  } finally { await run.context.close() }
}
async function phoneFirstLast(browser) {
  const run = await setup(browser, { width: 390, count: 6 }), { page, state } = run
  state.rows = state.rows.filter(row => ![id(2000), id(2001), id(2101), id(2102)].includes(row.id))
  try {
    await openSalon(run)
    const opened = []
    for (const n of [1000, 1005]) {
      const chosen = card(page, n); await reveal(page, chosen)
      const rect = await chosen.boundingBox()
      await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + Math.min(8, rect.height / 2))
      const details = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Détails du rendez-vous/i }) })
      await details.waitFor()
      assert((await details.innerText()).includes(`Client ${n}`), 'Tap opened a neighbouring appointment')
      opened.push(n)
      await details.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click()
      await details.waitFor({ state: 'hidden' })
    }
    const left = await page.evaluate(() => ({ page: scrollX, grid: (document.querySelector('[data-agenda-scroll]') || document.querySelector('[data-agenda-grid]').parentElement).scrollLeft }))
    assert.deepEqual(left, { page: 0, grid: 0 })
    assert.equal(state.mutations.length, 0); assert.deepEqual(state.unexpected, []); assert.deepEqual(run.errors, [])
    await shot(page, 'planning-phone-first-last-taps-390')
    return { scenario: 'phone-first-last', width: 390, staff: 6, opened, noHorizontalPan: true, requests: [] }
  } finally { await run.context.close() }
}
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const checks = ['payment', 'phone'].includes(args.only) ? [] : roles.map(role => ({ name: `drop-${role}`, run: () => dropSuccess(browser, role) }))
  if (!['payment', 'phone'].includes(args.only)) {
    checks.push({ name: 'drop-global-strict-therapist', run: () => dropSuccess(browser, 'therapist', 'global') })
    for (const mode of ['server-error', 'network-before', 'network-after']) checks.push({ name: `drop-${mode}`, run: () => dropRetry(browser, mode) })
  }
  if (!['drop', 'phone'].includes(args.only)) for (const variant of ['simple-card', 'simple-cash', 'partial-card', 'partial-mixed']) checks.push({ name: variant, run: () => paymentCase(browser, variant) })
  if (!['drop', 'phone'].includes(args.only)) {
    checks.push({ name: 'already-paid', run: () => alreadyPaidCase(browser) })
    checks.push({ name: 'payment-retry', run: () => paymentRetry(browser) })
  }
  if (!['drop', 'payment'].includes(args.only)) {
    checks.push({ name: 'phone-first-last', run: () => phoneFirstLast(browser) })
    checks.push({ name: 'drop-phone-admin', run: () => dropSuccess(browser, 'admin', 'salon', 390) })
    if (args.only === 'phone') checks.push({ name: 'simple-card', run: () => paymentCase(browser, 'simple-card', 390) })
  }
  const selected = checks.filter(check => !args.case || args.case === check.name)
  assert(selected.length, 'No requested interaction scenario matched')
  const savedName = result => result.name || (result.scenario === 'drop-success'
    ? result.kind === 'global' ? `drop-global-strict-${result.role}` : `drop-${result.role}`
    : result.scenario === 'drop-retry' ? `drop-${result.mode}` : result.scenario === 'payment' ? result.variant
      : result.scenario === 'payment-already-paid' ? 'already-paid' : result.scenario === 'payment-retry' ? 'payment-retry' : '')
  try {
    for (const check of selected) {
      report.failures = report.failures.filter(failure => failure.name !== check.name)
      report.checks = report.checks.filter(result => savedName(result) !== check.name)
      try { report.checks.push({ name: check.name, ...await check.run() }); console.log(`PASS ${check.name}`) }
      catch (error) { report.failures.push({ name: check.name, message: error.message }); console.log(`FAIL ${check.name}: ${error.message}`); break }
    }
  } finally {
    await browser.close(); report.browserClosed = true; report.pass = report.failures.length === 0
    fs.mkdirSync(outDir, { recursive: true })
    for (const item of captures) fs.writeFileSync(path.join(outDir, item.name), item.bytes)
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
  }
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, failures: report.failures }, null, 2))
  if (!report.pass) process.exitCode = 1
}
main().catch(error => { console.error(error); process.exitCode = 1 })
