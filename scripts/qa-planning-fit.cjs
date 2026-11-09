const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
// Run from the repository root against a local build. Every API is intercepted.
// node scripts/qa-planning-fit.cjs --url=http://127.0.0.1:3490
// Add --resume --widths=744,768 --skip-phone --skip-card-cases for a focused rerun.
// --only-phone checks the fitted phone grid, never a scrollable/paginated substitute.
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=') || true] }))
const origin = String(args.url || 'http://127.0.0.1:3490')
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Local fixture QA only')
const widths = String(args.widths || '744,768,820,1024,1280,1440,1600,1920').split(',').map(Number)
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const salonId = id(1)
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000))
const opening = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(key => [key, { open: '09:00', close: '18:00' }]))
const salons = [{ id: salonId, name: 'Temple stress QA', slug: 'qa', city: 'Paris', is_active: true, opening_hours: opening }]
const services = [{ id: id(10), name: 'Massage détente', planning_color: 'tangerine', required_staff_count: 1 }, { id: id(11), name: 'Massage crânien', planning_color: 'cyan', required_staff_count: 1 }, { id: id(12), name: 'Massage duo', planning_color: 'orchid', required_staff_count: 2 }].map(value => ({ ...value, price_cents: 8000, duration_minutes: 60, is_active: true, salon_ids: [salonId] }))
function time(hour) {
  const offset = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(`${day}T12:00:00Z`))) - 12
  return new Date(`${day}T${String(hour - offset).padStart(2, '0')}:00:00Z`).toISOString()
}
function fixture(count) {
  const staff = ['Alice', 'Béa', 'Chloé', 'Diane', 'Emma', 'Fanny', 'Gina', 'Hana', 'Inès', 'Jade', 'Katia', 'Linda'].slice(0, count).map((name, index) => ({ id: id(20 + index), salon_id: salonId, first_name: 'Madame', last_name: name, role: 'therapist', is_active: true, allowed_service_ids: [] }))
  function row(n, hour, index, options = {}) {
    const members = options.duo ? [staff[index], staff[index + 1]] : [staff[index]]
    const chosen = options.duo ? [services[2], services[1]] : [services[0], services[1]]
    return { id: id(n), salon_id: salonId, service_id: chosen[0].id, staff_id: members[0].id, start_time: time(hour), end_time: new Date(Date.parse(time(hour)) + (options.minutes || 60) * 60000).toISOString(), updated_at: `${day}T06:00:00.000Z`, status: options.status || 'confirmed', payment_status: options.unpaid ? 'unpaid' : 'paid', payment_method: options.unpaid ? null : 'stripe', source: 'planity', amount_paid_cents: options.unpaid ? 0 : 8000, client_requested_staff_ids: options.status === 'blocked' ? [] : [members[0].id], client: { id: id(5000 + n), first_name: `Client ${n}`, last_name: 'QA', phone: '0601020304', email: 'qa@example.test' }, service: chosen[0], planning_services: chosen, service_items: chosen, salon: salons[0], staff: members[0], assignments: members.map(member => ({ staff_id: member.id, staff: member })) }
  }
  const rows = staff.map((member, index) => row(1000 + index, 10, index, { unpaid: index % 3 === 1 }))
  rows.push(row(2000, 10, 0), row(2001, 10, 0, { unpaid: true }))
  rows.push(row(2100, 13, 0, { duo: true, minutes: 15 }), row(2101, 13, 0, { duo: true, minutes: 15 }), row(2102, 13, 0, { duo: true, minutes: 15, unpaid: true }))
  rows.push(row(2200, 14, count - 2, { duo: true, minutes: 15, status: 'cancelled' }))
  rows.push(row(2300, 15, Math.floor(count / 2), { status: 'blocked' }))
  rows.push(row(2400, 16, count - 1))
  return { staff, rows, unexpected: [], mutations: [], logs: [] }
}
async function contextFor(browser, width, count, role = 'admin', height = 1100) {
  const state = fixture(count), context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1100, isMobile: width < 1100, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  await context.addCookies([{ name: 'accessToken', value: 'fixture-only', domain: new URL(origin).hostname, path: '/' }])
  await context.addInitScript(role => { localStorage.setItem('adminToken', 'fixture-only'); localStorage.setItem('adminUser', JSON.stringify({ id: '00000000-0000-4000-8000-000000000900', role, first_name: 'Staff', last_name: 'QA' })) }, role)
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (url.origin !== origin) return route.abort()
    if (!url.pathname.startsWith('/api/')) { if (['GET', 'HEAD'].includes(method)) return route.continue(); state.unexpected.push(`${method} ${url.pathname}`); return route.abort() }
    if (method === 'GET') {
      if (url.pathname === '/api/salons') return reply(salons)
      if (url.pathname === '/api/staff') return reply(state.staff)
      if (url.pathname === '/api/services') return reply(services)
      if (url.pathname === '/api/appointments') return reply(state.rows)
      if (url.pathname.includes('/appointment-moves')) return reply({ entries: state.logs, next_cursor: null })
      if (url.pathname === '/api/clients') return reply([])
    }
    // Capture unexpected writes, but never pass any API traffic to the real server.
    if (method !== 'GET') state.mutations.push({ method, path: url.pathname, body: request.postDataJSON() })
    state.unexpected.push(`${method} ${url.pathname}`)
    return reply({ error: 'Fixture endpoint only; real API blocked' }, 500)
  })
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(60000)
  page.on('pageerror', error => errors.push(error.message))
  return { page, context, state, errors }
}
async function measure(page, state) {
  return page.evaluate(({ staffIds, expected }) => {
    const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } }
    const visible = el => { const r = el.getBoundingClientRect(), style = getComputedStyle(el); return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' }
    const insideX = (r, parent) => r.width > 0 && r.left >= Math.max(0, parent.left) - 1 && r.right <= Math.min(innerWidth, parent.right) + 1
    const inside = (r, parent, tolerance = .5) => r.width > 0 && r.height > 0 && r.left >= parent.left - tolerance && r.right <= parent.right + tolerance && r.top >= parent.top - tolerance && r.bottom <= parent.bottom + tolerance
    const paint = element => {
      const ranges = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue
        const range = document.createRange(); range.selectNodeContents(node)
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) ranges.push({ kind: 'text', text: node.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height })
      }
      for (const svg of element.querySelectorAll('svg')) if (visible(svg)) ranges.push({ kind: 'svg', ...box(svg) })
      return ranges
    }
    const clippedByAncestor = (element, painted, stop) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent), bounds = box(parent)
        if ((['hidden', 'clip', 'auto', 'scroll'].includes(css.overflowX) && (painted.left < bounds.left - .5 || painted.right > bounds.right + .5))
          || (['hidden', 'clip', 'auto', 'scroll'].includes(css.overflowY) && (painted.top < bounds.top - .5 || painted.bottom > bounds.bottom + .5))) return true
        if (parent === stop) break
      }
      return false
    }
    const tablet = document.querySelector('[data-agenda-grid]')
    const grid = tablet || document.querySelector('[data-planning-grid="salon"], [data-planning-grid="day"]')
    if (!grid) throw new Error('No planning grid marker found')
    const gridBox = box(grid), header = tablet ? document.querySelector('[data-agenda-team]') : document.querySelector('[data-planning-header]')
    const headerNodes = tablet ? [...header.children].slice(1) : [...header.querySelectorAll('[data-planning-staff-id]')]
    const headers = headerNodes.filter(visible).map((el, index) => ({ id: el.getAttribute('data-planning-staff-id') || staffIds[index], text: el.textContent.trim(), ...box(el), visibleX: insideX(box(el), box(header)) }))
    const columns = tablet ? [...grid.querySelectorAll('[data-agenda-column]')].map(el => ({ id: el.getAttribute('data-agenda-column'), ...box(el), visibleX: insideX(box(el), gridBox) })) : [...grid.querySelectorAll('[data-planning-cell-staff-id]')].filter(visible).slice(0, staffIds.length).map(el => ({ id: el.getAttribute('data-planning-cell-staff-id'), ...box(el), visibleX: insideX(box(el), gridBox) }))
    const markers = '.appointment-payment-symbol,.appointment-code,[data-service-color-star],[data-client-staff-choice],[data-duo-marker],[data-released-marker]'
    const cards = expected.flatMap(({ id, copies, time, name }) => [...grid.querySelectorAll(`[data-appointment-id="${id}"]`)].filter(visible).map(el => {
      const r = box(el), cells = [...el.querySelectorAll(markers)].map(marker => {
        const m = box(marker), shown = visible(marker), painted = paint(marker)
        return { label: marker.getAttribute('aria-label') || marker.getAttribute('title') || marker.textContent.trim(), ...m, shown, painted,
          inside: !shown || inside(m, r), outsideWrapper: painted.filter(p => !inside(p, m)),
          clippedPaint: painted.filter(p => !inside(p, r) || clippedByAncestor(marker, p, el)) }
      })
      const shown = cells.filter(m => m.shown)
      const overlappingMarkers = shown.some((a, index) => shown.slice(index + 1).some(b => a.left < b.right - .2 && a.right > b.left + .2 && a.top < b.bottom - .2 && a.bottom > b.top + .2))
      const paintedGlyphs = shown.flatMap(marker => marker.painted), overlappingPaint = paintedGlyphs.some((a, index) => paintedGlyphs.slice(index + 1).some(b => a.left < b.right - .2 && a.right > b.left + .2 && a.top < b.bottom - .2 && a.bottom > b.top + .2))
      const timeNode = el.querySelector('[data-card-start-time]') || el.querySelector('[data-card-time] > span:first-child')
      const paintedTime = timeNode ? paint(timeNode) : [], paintedTimeText = paintedTime.filter(p => p.kind === 'text').map(p => p.text).join('')
      const clippedTime = paintedTime.filter(p => !inside(p, r) || clippedByAncestor(timeNode, p, el))
      const content = el.querySelector('.agenda-card-content'), fullLabel = (content?.getAttribute('aria-label') || '') + ' ' + (content?.getAttribute('title') || '')
      return { id, copies, ...r, visibleX: insideX(r, gridBox), markers: cells, clippedMarkers: cells.filter(m => !m.inside), hiddenMarkers: cells.filter(m => !m.shown), overlappingMarkers,
        clippedGlyphs: cells.filter(m => !m.painted.length || m.clippedPaint.length), overlappingPaint, expectedTime: time, paintedTime, paintedTimeText, clippedTime,
        fullNameAccessible: fullLabel.includes(name), resize: Boolean(el.querySelector('[role="separator"]')) }
    }))
    const containers = [], seen = new Set()
    for (const element of [grid, header, ...[grid, header].flatMap(el => { const parents = []; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) parents.push(p); return parents })]) {
      if (seen.has(element)) continue; seen.add(element)
      containers.push({ marker: element.getAttribute('data-planning-grid') || (element.hasAttribute('data-agenda-scroll') ? 'agenda-scroll' : element.hasAttribute('data-agenda-team') ? 'agenda-team' : element.tagName), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: getComputedStyle(element).overflowX, ...box(element) })
    }
    const headerAligned = columns.every(column => { const header = headers.find(header => header.id === column.id); return header && Math.abs(header.left - column.left) < 1.1 && Math.abs(header.width - column.width) < 1.1 })
    return { type: tablet ? 'tablet' : 'legacy', viewport: innerWidth, viewportHeight: innerHeight, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, scrollX, scrollY, grid: gridBox, headers, columns, cards, containers, headerAligned }
  }, { staffIds: state.staff.map(member => member.id), expected: state.rows.map(row => ({ id: row.id,
    time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(row.start_time)),
    name: row.status === 'blocked' ? 'Bloqué' : [row.client.first_name, row.client.last_name].filter(Boolean).join(' '),
    copies: row.assignments.filter(assignment => state.staff.some(member => member.id === assignment.staff_id)).length })) })
}
const outDir = path.resolve('output/playwright'), reportFile = path.join(outDir, 'qa-planning-fit-results.json')
const captures = [], stylesheets = new Set(), results = args.resume && fs.existsSync(reportFile)
  ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : { origin, day, fixtureOnly: true, cases: [], failures: [] }
assert(results.origin === origin && results.day === day, 'Resume requires the same local origin and fixture day')
async function shot(page, name) { captures.push({ name: `${name}.png`, bytes: await page.screenshot({ animations: 'disabled' }) }) }
async function selectAgendaSalon(page) {
  await page.locator('[data-agenda-toolbar]').waitFor()
  const control = page.getByRole('combobox', { name: 'Salon du planning', exact: true })
  const inSummary = !await control.isVisible()
  if (inSummary) await page.getByRole('button', { name: 'Résumé et repères du planning', exact: true }).click()
  await control.selectOption(salonId)
  if (inSummary) {
    const summary = page.getByRole('dialog').filter({ has: control })
    await summary.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click()
    await summary.waitFor({ state: 'hidden' })
  }
}
async function runCase(browser, width, count, kind) {
  results.cases = results.cases.filter(test => !(test.width === width && test.count === count && test.kind === kind))
  results.failures = results.failures.filter(test => !(test.width === width && test.count === count && test.kind === kind))
  const run = await contextFor(browser, width, count), { page, state } = run
  try {
    await page.goto(`${origin}${kind === 'salon' ? `/admin/salons/${salonId}/dashboard?date=${day}` : '/admin/calendrier'}`)
    if (kind === 'global') {
      if (width < 1536) {
        await selectAgendaSalon(page)
        await page.getByRole('button', { name: 'Jour suivant', exact: true }).click()
      } else {
        await page.getByRole('combobox').first().click()
        await page.getByRole('option', { name: 'Temple stress QA - Paris', exact: true }).click()
        await page.getByRole('tab', { name: 'Jour', exact: true }).click()
        await page.getByRole('button', { name: 'Période suivante', exact: true }).click()
      }
    }
    const first = page.locator(`[data-appointment-id="${id(1000)}"]:visible`).first()
    await first.waitFor()
    if (width < 1536) await page.locator('[data-agenda-grid]').waitFor()
    for (const href of await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => link.href))) stylesheets.add(href)
    const geometry = await measure(page, state)
    results.cases.push({ width, count, kind, ...geometry })
    assert(geometry.documentWidth <= width, `Document overflow ${geometry.documentWidth}`)
    assert(geometry.containers.every(el => el.scrollWidth <= el.clientWidth + 1), `Planning horizontal overflow ${JSON.stringify(geometry.containers.filter(el => el.scrollWidth > el.clientWidth + 1))}`)
    assert.equal(geometry.headers.length, count, 'Hidden/missing staff headers')
    assert(geometry.headers.every(header => header.visibleX), 'Staff header outside viewport/parent')
    assert.equal(geometry.headers[0].id, state.staff[0].id); assert.equal(geometry.headers.at(-1).id, state.staff.at(-1).id)
    assert.equal(geometry.columns.length, count, 'Hidden/missing staff columns')
    assert(geometry.columns.every(column => column.visibleX), 'Staff column outside viewport/parent')
    assert(geometry.headerAligned, 'Staff headers and columns are not aligned')
    for (const row of state.rows) assert.equal(geometry.cards.filter(card => card.id === row.id).length, row.assignments.length, `Hidden/missing appointment ${row.id}`)
    assert(geometry.cards.every(card => card.visibleX), 'Appointment outside viewport/parent')
    assert(geometry.cards.every(card => !card.clippedMarkers.length && !card.hiddenMarkers.length && !card.overlappingMarkers), 'Appointment indicator clipped/hidden/overlapping')
    // All columns and appointment edges are measured before any horizontal scrolling.
    await first.scrollIntoViewIfNeeded()
    await first.evaluate(el => { const toolbar = document.querySelector('[data-agenda-toolbar]'); scrollBy(0, el.getBoundingClientRect().top - (toolbar?.getBoundingClientRect().bottom || 80) - 18) })
    await shot(page, `planning-fit-${kind}-${count}-${width}`)
    const short = page.locator(`[data-appointment-id="${id(2100)}"]:visible`).first()
    await short.scrollIntoViewIfNeeded()
    await short.evaluate(el => { const toolbar = document.querySelector('[data-agenda-toolbar]'); scrollBy(0, el.getBoundingClientRect().top - (toolbar?.getBoundingClientRect().bottom || 80) - 18) })
    await shot(page, `planning-fit-${kind}-short-${count}-${width}`)
    assert.deepEqual(run.errors, []); assert.deepEqual(state.unexpected, []); assert.equal(state.mutations.length, 0)
    console.log(`PASS ${kind} staff=${count} width=${width}`)
  } catch (error) {
    results.failures.push({ width, count, kind, message: error.message, runtime: run.errors, unexpected: state.unexpected })
    await shot(page, `planning-fit-failure-${kind}-${count}-${width}`)
    console.log(`FAIL ${kind} staff=${count} width=${width}: ${error.message}`)
  } finally { await run.context.close() }
}
function assertFittedPhone(geometry, state, label) {
  assert(geometry.documentWidth <= geometry.viewport, label + ': document overflow')
  assert.equal(geometry.scrollX, 0, label + ': page already scrolled horizontally')
  assert(geometry.containers.every(el => el.scrollWidth <= el.clientWidth + 1), label + ': grid/header/ancestor overflow ' + JSON.stringify(geometry.containers.filter(el => el.scrollWidth > el.clientWidth + 1)))
  assert.equal(geometry.headers.length, state.staff.length, label + ': staff headers omitted or paginated')
  assert.equal(geometry.columns.length, state.staff.length, label + ': staff columns omitted or paginated')
  assert(geometry.headers.every(header => header.visibleX), label + ': staff header clipped')
  assert(geometry.columns.every(column => column.visibleX), label + ': staff column clipped')
  assert(geometry.headerAligned, label + ': headers and columns do not align')
  for (const row of state.rows) {
    const copies = row.assignments.filter(assignment => state.staff.some(member => member.id === assignment.staff_id)).length
    const rendered = geometry.cards.filter(card => card.id === row.id)
    assert.equal(rendered.length, copies, label + ': booking missing/paginated ' + row.id)
    // These fixtures carry payment + source P + two stars + client lock;
    // paid rows also carry L, duos their link, released rows their trace icon.
    const expectedMarkers = row.status === 'blocked' ? 0 : (row.payment_status === 'paid' ? 6 : 5)
      + Number(row.assignments.length > 1) + Number(['cancelled', 'no_show'].includes(row.status))
    for (const card of rendered) assert.equal(card.markers.length, expectedMarkers, label + ': phone removed an indicator from ' + row.id)
  }
  assert(geometry.cards.every(card => card.visibleX), label + ': booking outside the visible width')
  const bad = geometry.cards.filter(card => card.clippedMarkers.length || card.hiddenMarkers.length || card.overlappingMarkers || card.clippedGlyphs.length || card.overlappingPaint)
  assert.equal(bad.length, 0, label + ': indicator paint clipped/hidden/overlapping ' + JSON.stringify(bad.slice(0, 2).map(card => ({ id: card.id, width: card.width, clipped: card.clippedMarkers, hidden: card.hiddenMarkers, glyphs: card.clippedGlyphs, overlap: card.overlappingMarkers || card.overlappingPaint }))))
  const badTime = geometry.cards.filter(card => card.height >= 44 && (card.paintedTimeText !== card.expectedTime || card.clippedTime.length))
  assert.equal(badTime.length, 0, label + ': HH:mm clipped or incomplete ' + JSON.stringify(badTime.slice(0, 2).map(card => ({ id: card.id, width: card.width, expected: card.expectedTime, text: card.paintedTimeText, clipped: card.clippedTime }))))
  assert(geometry.cards.every(card => card.fullNameAccessible), label + ': ellipsized name has no complete accessible label')
}
async function phoneLegend(page) {
  const metrics = await page.locator('[data-compact-agenda-legend]').evaluate(legend => {
    const b = legend.getBoundingClientRect(), painted = [], walker = document.createTreeWalker(legend, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue
      const range = document.createRange(); range.selectNodeContents(node)
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) painted.push({ text: node.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom })
    }
    for (const svg of legend.querySelectorAll('svg')) { const r = svg.getBoundingClientRect(); if (r.width > 0 && r.height > 0) painted.push({ text: 'SVG', left: r.left, right: r.right, top: r.top, bottom: r.bottom }) }
    return { text: legend.textContent, labels: [...legend.querySelectorAll('[role="img"]')].map(el => el.getAttribute('aria-label')), codes: [...legend.querySelectorAll('.appointment-code')].map(el => el.textContent),
      left: b.left, right: b.right, top: b.top, bottom: b.bottom, height: b.height, width: b.width, viewportWidth: innerWidth, viewportHeight: innerHeight,
      clippedPaint: painted.filter(r => r.left < Math.max(0, b.left) - .5 || r.right > Math.min(innerWidth, b.right) + .5 || r.top < Math.max(0, b.top) - .5 || r.bottom > Math.min(innerHeight, b.bottom) + .5) }
  })
  assert(metrics.width > 0 && metrics.height > 0 && metrics.height <= 90, 'Compact legend hidden or too tall')
  assert(metrics.left >= 0 && metrics.right <= metrics.viewportWidth && metrics.top >= 0 && metrics.bottom <= metrics.viewportHeight, 'Compact legend outside initial phone viewport')
  for (const label of ['Attendu', 'Venu', 'Absent', 'Annulé', 'Bloqué', 'Payé', 'À payer', 'En ligne', 'Treatwell', 'Planity', 'Forfait', 'Cadeau', 'Duo', 'Choix client', 'Prestation']) assert(metrics.text.includes(label), 'Compact legend missing ' + label)
  assert.deepEqual(metrics.codes, ['L', 'T', 'P', 'F', 'C'], 'Compact legend omitted a source/payment code')
  assert(metrics.labels.some(label => label.includes('Coche')) && metrics.labels.some(label => label.includes('Croix')), 'Compact legend lacks accessible check/cross explanation')
  assert.equal(metrics.clippedPaint.length, 0, 'Compact legend text/icon paint clipped: ' + JSON.stringify(metrics.clippedPaint))
  return metrics
}
async function phoneSecondaryControls(page, state) {
  const open = async () => {
    await page.getByRole('button', { name: 'Résumé et repères du planning', exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Résumé du jour', exact: true }) }); await dialog.waitFor(); return dialog
  }
  let dialog = await open()
  const service = dialog.getByRole('combobox', { name: 'Filtrer par prestation', exact: true })
  const precision = dialog.getByRole('combobox', { name: 'Précision du planning', exact: true })
  assert(await service.isVisible() && await precision.isVisible(), 'Secondary service/precision controls disappeared on phone')
  await service.selectOption(id(12))
  const duoCopies = state.rows.filter(row => row.service_id === id(12)).reduce((sum, row) => sum + row.assignments.length, 0)
  await page.waitForFunction(expected => document.querySelectorAll('[data-agenda-grid] [data-appointment-id]').length === expected, duoCopies)
  await service.selectOption('all')
  await page.waitForFunction(expected => document.querySelectorAll('[data-agenda-grid] [data-appointment-id]').length === expected, state.rows.reduce((sum, row) => sum + row.assignments.length, 0))
  await precision.selectOption('15')
  await page.waitForFunction(() => document.querySelector('[data-calendar-slot]').getBoundingClientRect().height >= 44 && document.querySelector('[data-calendar-slot]').getBoundingClientRect().height < 46)
  const preciseSlotHeight = await page.locator('[data-calendar-slot]').first().evaluate(el => el.getBoundingClientRect().height)
  await precision.selectOption('30')
  await dialog.getByRole('button', { name: 'Afficher les 24 h', exact: true }).click(); await dialog.waitFor({ state: 'hidden' })
  const hours = page.locator('[data-agenda-grid] > div').first()
  assert((await hours.innerText()).includes('00:00') && (await hours.innerText()).includes('23:00'), '24-hour view lost early/late hours')
  assert.equal(await hours.locator(':scope > div').count(), 24)
  dialog = await open()
  await dialog.getByRole('button', { name: 'Horaires du salon', exact: true }).click(); await dialog.waitFor({ state: 'hidden' })
  assert((await hours.innerText()).includes('09:00') && !(await hours.innerText()).includes('00:00'), 'Salon hours could not be restored')
  return { serviceFilterAndReset: true, precision15AndReset: true, preciseSlotHeight, all24HoursAndReset: true, dialogClosed: true }
}
async function phoneCase(browser, width, height, count, kind) {
  const key = { width, height, count, kind }, label = kind + ' phone=' + width + ' staff=' + count
  results.phoneCases = (results.phoneCases || []).filter(test => !(test.width === width && test.count === count && test.kind === kind))
  results.failures = results.failures.filter(test => !(test.kind === 'phone' && test.width === width && test.count === count && test.page === kind))
  const run = await contextFor(browser, width, count, 'admin', height), { page, state } = run
  // A normal team and a genuinely dense twelve-person team exercise both cases.
  const density = count === 12 ? 'dense' : 'normal'
  if (density === 'normal') state.rows = state.rows.filter(row => ![id(2000), id(2001), id(2101), id(2102)].includes(row.id))
  let initial
  try {
    await page.goto(origin + (kind === 'salon' ? '/admin/salons/' + salonId + '/dashboard?date=' + day : '/admin/calendrier'))
    if (kind === 'global') {
      await selectAgendaSalon(page)
      await page.getByRole('button', { name: 'Jour suivant', exact: true }).click()
    }
    const grid = page.locator('[data-agenda-grid]'); await grid.waitFor()
    await page.locator('[data-appointment-id="' + id(1000) + '"]:visible').first().waitFor()
    for (const href of await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => link.href))) stylesheets.add(href)
    // This measurement happens before any programmatic or finger scrolling.
    initial = await measure(page, state)
    const legend = await phoneLegend(page)
    assertFittedPhone(initial, state, label + ' initial')
    assert(initial.grid.top < height - 96, label + ': planning hidden below the initial viewport')
    assert.equal(initial.headers[0].id, state.staff[0].id)
    assert.equal(initial.headers.at(-1).id, state.staff.at(-1).id)
    const hours = await grid.locator(':scope > div').first().innerText()
    assert(hours.includes('09:00') && hours.includes('17:00'), label + ': part of the day was omitted')
    await shot(page, 'planning-phone-initial-' + kind + '-' + count + '-' + width)
    // The historical phone layout scrolls through hours vertically. Never pan X
    // to make a card/header appear, including before screenshots or interactions.
    const first = page.locator('[data-appointment-id="' + id(1000) + '"]:visible').first()
    await first.evaluate(el => { const toolbar = document.querySelector('[data-agenda-toolbar]'); scrollBy({ left: 0, top: el.getBoundingClientRect().top - (toolbar?.getBoundingClientRect().bottom || 80) - 18 }) })
    await shot(page, 'planning-phone-' + kind + '-' + count + '-' + width)
    const slot = page.locator('[data-calendar-slot="tablet-' + id(20) + '-12-0"]')
    await slot.evaluate(el => { const toolbar = document.querySelector('[data-agenda-toolbar]'); scrollBy({ left: 0, top: el.getBoundingClientRect().top - (toolbar?.getBoundingClientRect().bottom || 80) - 24 }) })
    const rect = await slot.boundingBox(), session = await run.context.newCDPSession(page)
    const y = rect.y + Math.min(15, rect.height / 2)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width - 30, y }] })
    for (let step = 1; step <= 14; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width - 30 - (width - 90) * step / 14, y }] })
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach()
    const afterSwipe = await page.evaluate(() => ({ pageLeft: scrollX, gridLeft: (document.querySelector('[data-agenda-scroll]') || document.querySelector('[data-agenda-grid]').parentElement).scrollLeft, headerLeft: document.querySelector('[data-agenda-team]').parentElement.scrollLeft }))
    assert.deepEqual(afterSwipe, { pageLeft: 0, gridLeft: 0, headerLeft: 0 }, label + ': swipe revealed a hidden team page')
    assert.equal(await page.getByRole('dialog').count(), 0, label + ': swipe accidentally opened a booking form')
    assertFittedPhone(await measure(page, state), state, label + ' after swipe')
    const filter = page.getByLabel('Afficher une masseuse', { exact: true }), last = state.staff.at(-1)
    await filter.selectOption(last.id)
    await page.waitForFunction(() => document.querySelectorAll('[data-agenda-column]').length === 1)
    const selected = { ...state, staff: [last], rows: state.rows.filter(row => row.assignments.some(assignment => assignment.staff_id === last.id)) }
    assertFittedPhone(await measure(page, selected), selected, label + ' filtered')
    await filter.selectOption('all')
    await page.waitForFunction(count => document.querySelectorAll('[data-agenda-column]').length === count, count)
    assertFittedPhone(await measure(page, state), state, label + ' reset')
    const secondaryControls = width === 390 && count === 6 && kind === 'salon' ? await phoneSecondaryControls(page, state) : undefined
    if (secondaryControls) assertFittedPhone(await measure(page, state), state, label + ' restored secondary controls')
    if (count === 12 && width === 390) {
      const short = page.locator('[data-appointment-id="' + id(2100) + '"]:visible').first()
      await short.evaluate(el => { const toolbar = document.querySelector('[data-agenda-toolbar]'); scrollBy({ left: 0, top: el.getBoundingClientRect().top - (toolbar?.getBoundingClientRect().bottom || 80) - 18 }) })
      await shot(page, 'planning-phone-' + kind + '-dense-short-' + width)
    }
    assert.deepEqual(state.unexpected, []); assert.equal(state.mutations.length, 0); assert.deepEqual(run.errors, [])
    results.phoneCases.push({ ...key, density, pass: true, ...initial, legend, secondaryControls, afterSwipe, filterReset: true, allHoursPresent: true, verticalScrollRetained: initial.documentHeight > height })
    console.log('PASS ' + label + ' whole team without horizontal scrolling')
  } catch (error) {
    results.phoneCases.push({ ...key, density, pass: false, ...initial })
    results.failures.push({ kind: 'phone', page: kind, width, height, count, message: error.message })
    await shot(page, 'planning-phone-failure-' + kind + '-' + count + '-' + width)
    console.log('FAIL ' + label + ': ' + error.message)
  } finally { await run.context.close() }
}
async function cardCases(browser) {
  results.failures = results.failures.filter(test => test.kind !== 'card-cases')
  const ts = require('typescript'), vm = require('node:vm'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), loaded = new Map()
  function load(file) {
    const filename = path.resolve(file)
    if (loaded.has(filename)) return loaded.get(filename).exports
    const module = { exports: {} }; loaded.set(filename, module)
    const localRequire = name => {
      if (!name.startsWith('@/')) return require(name)
      const target = path.resolve(name.slice(2)), resolved = ['.tsx', '.ts'].map(ext => target + ext).find(file => fs.existsSync(file))
      if (!resolved) throw new Error(`Cannot load real component dependency ${name}`)
      return load(resolved)
    }
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
    vm.runInNewContext(compiled, { exports: module.exports, module, require: localRequire }, { filename }); return module.exports
  }
  const { AppointmentCardContent } = load('components/calendar/appointment-card-content.tsx')
  const appointment = fixture(2).rows.find(row => row.id === id(2100))
  results.cardCases = []
  for (const board of [{ key: '111-120-150', widths: [111, 120, 150], viewport: 744, columns: 3 }, { key: '12-16-20-30', widths: [12, 16, 20, 30], viewport: 390, columns: 4 }]) {
    const cases = [22, 44, 64, 84].flatMap(height => board.widths.map(width => ({ height, width, key: width + 'x' + height })))
    const html = cases.map(({ height, width, key }) => '<section><p style="margin:0 0 8px;font-size:12px">' + width + ' × ' + height + ' px</p><div data-card-case="' + key + '" class="appointment-tone appointment-tone-blue relative overflow-hidden rounded-lg border border-l-2 sm:border-l-[3px] text-left ' + (height < 44 ? 'p-0' : 'p-px sm:p-1') + '" style="width:' + width + 'px;height:' + height + 'px">' + renderToStaticMarkup(React.createElement(AppointmentCardContent, { appointment, height })) + '</div></section>').join('')
    const context = await browser.newContext({ viewport: { width: board.viewport, height: 1100 }, deviceScaleFactor: 1 }), page = await context.newPage()
    await context.route('**/*', route => { const request = route.request(), url = new URL(request.url()); return request.method() === 'GET' && url.origin === origin && url.pathname.startsWith('/_next/static/') ? route.continue() : route.abort() })
    try {
      assert(stylesheets.size, 'No real built stylesheets captured for component rendering')
      await page.setContent('<html><head>' + [...stylesheets].map(href => '<link rel="stylesheet" href="' + href + '">').join('') + '</head><body><main style="padding:24px;display:grid;grid-template-columns:repeat(' + board.columns + ',minmax(0,1fr));gap:28px 16px">' + html + '</main></body></html>')
      await page.evaluate(() => document.fonts.ready)
      const metrics = await page.locator('[data-card-case]').evaluateAll(cards => cards.map(card => {
        const rect = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height } }, r = rect(card)
        const inside = b => b.width > 0 && b.height > 0 && b.left >= r.left - .5 && b.right <= r.right + .5 && b.top >= r.top - .5 && b.bottom <= r.bottom + .5
        const paint = element => {
          const ranges = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent.trim()) continue
            const range = document.createRange(); range.selectNodeContents(node)
            for (const b of range.getClientRects()) if (b.width > 0 && b.height > 0) ranges.push({ kind: 'text', text: node.textContent, left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height })
          }
          for (const svg of element.querySelectorAll('svg')) { const b = rect(svg); if (b.width > 0 && b.height > 0) ranges.push({ kind: 'svg', ...b }) }
          return ranges
        }
        const selectors = '.appointment-payment-symbol,.appointment-code,[data-service-color-star],[data-client-staff-choice],[data-duo-marker]'
        const markers = [...card.querySelectorAll(selectors)].map(el => ({ label: el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim(), ...rect(el), painted: paint(el) }))
        const fields = [...card.querySelectorAll('[data-card-time],[data-card-name],[data-care-state],[data-card-service]')].filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height).map(el => ({ text: el.textContent, ...rect(el) }))
        const timeNode = card.querySelector('[data-card-start-time]'), time = timeNode ? paint(timeNode) : [], glyphs = markers.flatMap(marker => marker.painted)
        return { key: card.getAttribute('data-card-case'), card: r, markers, fields, time, timeText: time.filter(p => p.kind === 'text').map(p => p.text).join(''),
          clipped: [...markers, ...fields, ...time, ...glyphs].filter(b => !inside(b)),
          overlap: glyphs.some((a, i) => glyphs.slice(i + 1).some(b => a.left < b.right - .2 && a.right > b.left + .2 && a.top < b.bottom - .2 && a.bottom > b.top + .2)) }
      }))
      results.cardCases.push(...metrics)
      await shot(page, 'planning-fit-card-cases-' + board.key)
      for (const metric of metrics) {
        assert.equal(metric.markers.length, 7, 'Marker count ' + metric.key)
        assert(metric.markers.every(marker => marker.painted.length), 'Unpainted glyph ' + metric.key)
        assert.equal(metric.clipped.length, 0, 'Clipped marker/text/paint ' + metric.key + ' ' + JSON.stringify(metric.clipped))
        assert(!metric.overlap, 'Overlapping painted glyph ' + metric.key)
        if (metric.card.height >= 44) assert.equal(metric.timeText, '13:00', 'HH:mm incomplete ' + metric.key)
      }
      console.log('PASS exact card widths' + board.widths.join('/') + ' heights22/44/64/84 (Range + SVG paint)')
    } catch (error) { results.failures.push({ kind: 'card-cases', board: board.key, message: error.message }); await shot(page, 'planning-fit-card-cases-failure-' + board.key); console.log('FAIL exact card cases ' + board.key + ': ' + error.message) }
    finally { await context.close() }
  }
}
async function overviewCase(browser, width) {
  const run = await contextFor(browser, width, 2), { page, state } = run
  state.rows = state.rows.filter(row => row.id === id(1000) || row.id === id(1001))
  state.rows[1].start_time = time(11); state.rows[1].end_time = time(12)
  results.overview = (results.overview || []).filter(test => test.width !== width)
  results.failures = results.failures.filter(test => !(test.kind === 'overview' && test.width === width))
  try {
    await page.goto(`${origin}/admin/calendrier`)
    if (width < 1536) {
      await page.getByRole('combobox', { name: 'Salon du planning', exact: true }).selectOption(salonId)
      await page.getByRole('button', { name: 'Résumé et repères du planning', exact: true }).click()
      await page.getByRole('button', { name: 'Vue mois ou semaine', exact: true }).click()
    } else {
      await page.getByRole('combobox').first().click()
      await page.getByRole('option', { name: 'Temple stress QA - Paris', exact: true }).click()
    }
    const views = []
    for (const [name, marker] of [['Mois', null], ['Semaine', 'week'], ['Jour', 'day']]) {
      await page.getByRole('tab', { name, exact: true }).click()
      const grid = marker ? page.locator(`[data-planning-grid="${marker}"]`) : page.locator('div.grid-cols-7:visible').first()
      await grid.waitFor()
      const metrics = await grid.evaluate(grid => {
        const r = grid.getBoundingClientRect(), rect = el => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, width: b.width, height: b.height } }
        const header = grid.querySelector('[data-planning-header]'), nodes = header ? [...header.children].slice(1) : [...grid.children].slice(0, 7)
        const headers = nodes.map(el => ({ text: el.textContent.trim(), ...rect(el) }))
        const containers = []
        for (let el = grid; el && el !== document.body; el = el.parentElement) containers.push({ tag: el.tagName, client: el.clientWidth, scroll: el.scrollWidth })
        return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, grid: rect(grid), clientWidth: grid.clientWidth, scrollWidth: grid.scrollWidth, headers, containers, allHeadersInside: headers.every(h => h.width > 0 && h.left >= Math.max(0, r.left) - 1 && h.right <= Math.min(innerWidth, r.right) + 1) }
      })
      assert(metrics.documentWidth <= width && metrics.viewport <= width, `${name} document overflow`)
      assert(metrics.containers.every(el => el.scroll <= el.client + 1), `${name} grid/ancestor overflow: ${JSON.stringify(metrics.containers)}`)
      assert(metrics.allHeadersInside, `${name} header clipped`)
      if (name === 'Semaine' || name === 'Mois') assert.equal(metrics.headers.length, 7, `${name} must show all seven days`)
      views.push({ name, ...metrics })
      await grid.evaluate(el => scrollBy(0, el.getBoundingClientRect().top - 80))
      await shot(page, `planning-fit-overview-${marker || 'month'}-${width}`)
    }
    assert.deepEqual(run.errors, []); assert.deepEqual(state.unexpected, []); assert.equal(state.mutations.length, 0)
    results.overview.push({ width, views }); console.log(`PASS overview month/week/day ${width}`)
  } catch (error) { results.failures.push({ kind: 'overview', width, message: error.message }); await shot(page, `planning-fit-overview-failure-${width}`); console.log(`FAIL overview ${width}: ${error.message}`) }
  finally { await run.context.close() }
}
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    if (!args['only-phone']) for (const width of widths) for (const count of [10, 12]) for (const kind of ['salon', 'global']) await runCase(browser, width, count, kind)
    if (!args['skip-phone']) {
      const heights = { 320: 568, 360: 640, 375: 667, 390: 844, 430: 932 }
      for (const width of String(args['phone-widths'] || '320,360,375,390,430').split(',').map(Number))
        for (const count of String(args['phone-counts'] || '3,6,12').split(',').map(Number))
          for (const kind of args['phone-kind'] ? [String(args['phone-kind'])] : ['salon', 'global']) await phoneCase(browser, width, heights[width] || 844, count, kind)
    }
    if (!args['only-phone'] && !args['skip-card-cases']) await cardCases(browser)
    if (!args['only-phone'] && !args['skip-views']) for (const width of [820, 1536]) await overviewCase(browser, width)
  }
  finally {
    await browser.close()
    results.browserClosed = true; results.pass = results.failures.length === 0
    fs.mkdirSync(outDir, { recursive: true })
    for (const item of captures) fs.writeFileSync(path.join(outDir, item.name), item.bytes)
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2))
  }
  console.log(JSON.stringify({ pass: results.pass, cases: results.cases.length, phoneCases: results.phoneCases?.length || 0, failures: results.failures }, null, 2))
  if (!results.pass) process.exitCode = 1
}
module.exports = { origin, contextFor, fixture, time, id, salonId, day, services }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
