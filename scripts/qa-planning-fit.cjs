const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
// Run from the repository root against a local build. Every API is intercepted.
// node scripts/qa-planning-fit.cjs --url=http://127.0.0.1:3390
// Add --resume --widths=744,768 --skip-phone --skip-card-cases for a focused rerun.
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=') || true] }))
const origin = String(args.url || 'http://127.0.0.1:3390')
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
async function contextFor(browser, width, count, role = 'admin') {
  const state = fixture(count), context = await browser.newContext({ viewport: { width, height: 1100 }, hasTouch: width < 1100, isMobile: width < 1100, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
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
    const tablet = document.querySelector('[data-agenda-grid]')
    const grid = tablet || document.querySelector('[data-planning-grid="salon"], [data-planning-grid="day"]')
    if (!grid) throw new Error('No planning grid marker found')
    const gridBox = box(grid), header = tablet ? document.querySelector('[data-agenda-team]') : document.querySelector('[data-planning-header]')
    const headerNodes = tablet ? [...header.children].slice(1) : [...header.querySelectorAll('[data-planning-staff-id]')]
    const headers = headerNodes.filter(visible).map((el, index) => ({ id: el.getAttribute('data-planning-staff-id') || staffIds[index], text: el.textContent.trim(), ...box(el), visibleX: insideX(box(el), box(header)) }))
    const columns = tablet ? [...grid.querySelectorAll('[data-agenda-column]')].map(el => ({ id: el.getAttribute('data-agenda-column'), ...box(el), visibleX: insideX(box(el), gridBox) })) : [...grid.querySelectorAll('[data-planning-cell-staff-id]')].filter(visible).slice(0, staffIds.length).map(el => ({ id: el.getAttribute('data-planning-cell-staff-id'), ...box(el), visibleX: insideX(box(el), gridBox) }))
    const markers = '.appointment-payment-symbol,.appointment-code,[data-service-color-star],[data-client-staff-choice],[data-duo-marker],[data-released-marker]'
    const cards = expected.flatMap(({ id, copies }) => [...grid.querySelectorAll(`[data-appointment-id="${id}"]`)].filter(visible).map(el => {
      const r = box(el), cells = [...el.querySelectorAll(markers)].map(marker => {
        const m = box(marker), shown = visible(marker)
        return { label: marker.getAttribute('aria-label') || marker.getAttribute('title') || marker.textContent.trim(), ...m, shown, inside: !shown || (m.left >= r.left - 1 && m.right <= r.right + 1 && m.top >= r.top - 1 && m.bottom <= r.bottom + 1) }
      })
      const shown = cells.filter(m => m.shown)
      const overlappingMarkers = shown.some((a, index) => shown.slice(index + 1).some(b => a.left < b.right - .2 && a.right > b.left + .2 && a.top < b.bottom - .2 && a.bottom > b.top + .2))
      return { id, copies, ...r, visibleX: insideX(r, gridBox), markers: cells, clippedMarkers: cells.filter(m => !m.inside), hiddenMarkers: cells.filter(m => !m.shown), overlappingMarkers, resize: Boolean(el.querySelector('[role="separator"]')) }
    }))
    const containers = [], seen = new Set()
    for (const element of [grid, header, ...[grid, header].flatMap(el => { const parents = []; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) parents.push(p); return parents })]) {
      if (seen.has(element)) continue; seen.add(element)
      containers.push({ marker: element.getAttribute('data-planning-grid') || (element.hasAttribute('data-agenda-scroll') ? 'agenda-scroll' : element.hasAttribute('data-agenda-team') ? 'agenda-team' : element.tagName), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: getComputedStyle(element).overflowX, ...box(element) })
    }
    const headerAligned = columns.every(column => { const header = headers.find(header => header.id === column.id); return header && Math.abs(header.left - column.left) < 1.1 && Math.abs(header.width - column.width) < 1.1 })
    return { type: tablet ? 'tablet' : 'legacy', viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, grid: gridBox, headers, columns, cards, containers, headerAligned }
  }, { staffIds: state.staff.map(member => member.id), expected: state.rows.map(row => ({ id: row.id, copies: row.assignments.length })) })
}
const outDir = path.resolve('output/playwright'), reportFile = path.join(outDir, 'qa-planning-fit-results.json')
const captures = [], stylesheets = new Set(), results = args.resume && fs.existsSync(reportFile)
  ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : { origin, day, fixtureOnly: true, cases: [], failures: [] }
assert(results.origin === origin && results.day === day, 'Resume requires the same local origin and fixture day')
async function shot(page, name) { captures.push({ name: `${name}.png`, bytes: await page.screenshot({ animations: 'disabled' }) }) }
async function runCase(browser, width, count, kind) {
  results.cases = results.cases.filter(test => !(test.width === width && test.count === count && test.kind === kind))
  results.failures = results.failures.filter(test => !(test.width === width && test.count === count && test.kind === kind))
  const run = await contextFor(browser, width, count), { page, state } = run
  try {
    await page.goto(`${origin}${kind === 'salon' ? `/admin/salons/${salonId}/dashboard?date=${day}` : '/admin/calendrier'}`)
    if (kind === 'global') {
      if (width < 1536) {
        await page.getByRole('combobox', { name: 'Salon du planning', exact: true }).selectOption(salonId)
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
async function phoneCase(browser) {
  results.failures = results.failures.filter(test => test.kind !== 'phone')
  const run = await contextFor(browser, 390, 12), { page, state } = run
  try {
    await page.goto(`${origin}/admin/salons/${salonId}/dashboard?date=${day}`)
    const scroll = page.locator('[data-agenda-scroll]'); await scroll.waitFor()
    const slot = page.locator(`[data-calendar-slot="tablet-${id(20)}-12-0"]`)
    await slot.scrollIntoViewIfNeeded()
    await slot.evaluate(el => { const toolbar = document.querySelector('[data-agenda-toolbar]'); scrollBy(0, el.getBoundingClientRect().top - (toolbar?.getBoundingClientRect().bottom || 80) - 18) })
    await scroll.evaluate(el => { el.scrollLeft = 0 })
    const rect = await slot.boundingBox(), session = await run.context.newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y: rect.y + 15 }] })
    for (let step = 1; step <= 14; step++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 330 - 240 * step / 14, y: rect.y + 15 }] }); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve))) }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach()
    await page.waitForFunction(() => document.querySelector('[data-agenda-scroll]').scrollLeft > 20)
    const metrics = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, client: document.querySelector('[data-agenda-scroll]').clientWidth, scrollWidth: document.querySelector('[data-agenda-scroll]').scrollWidth, scrollLeft: document.querySelector('[data-agenda-scroll]').scrollLeft, headerLeft: document.querySelector('[data-agenda-team]').parentElement.scrollLeft }))
    assert(metrics.documentWidth <= 390 && metrics.viewport <= 390)
    assert(metrics.scrollWidth > metrics.client && metrics.scrollLeft > 20)
    assert(Math.abs(metrics.scrollLeft - metrics.headerLeft) < 1.1)
    assert.deepEqual(state.unexpected, []); assert.equal(state.mutations.length, 0); assert.deepEqual(run.errors, [])
    await shot(page, 'planning-fit-phone-scroll-390')
    results.phone = { width: 390, count: 12, ...metrics, touchScroll: true, synchronizedHeader: true }
    console.log('PASS phone 390 scroll preserved')
  } catch (error) { results.failures.push({ kind: 'phone', width: 390, count: 12, message: error.message }); await shot(page, 'planning-fit-phone-failure-390'); console.log(`FAIL phone390: ${error.message}`) }
  finally { await run.context.close() }
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
  const cases = [22, 44, 64, 84].flatMap(height => [111, 120, 150].map(width => ({ height, width, key: `${width}x${height}` })))
  const html = cases.map(({ height, width, key }) => `<section><p style="margin:0 0 8px">${width} px × ${height} px · 7 indicateurs</p><div data-card-case="${key}" class="appointment-tone appointment-tone-blue relative overflow-hidden rounded-lg border border-l-[3px] text-left ${height < 44 ? 'p-0' : 'p-0.5 sm:p-1'}" style="width:${width}px;height:${height}px">${renderToStaticMarkup(React.createElement(AppointmentCardContent, { appointment, height }))}</div></section>`).join('')
  const context = await browser.newContext({ viewport: { width: 744, height: 1100 }, deviceScaleFactor: 1 }), page = await context.newPage()
  await context.route('**/*', route => { const request = route.request(), url = new URL(request.url()); return request.method() === 'GET' && url.origin === origin && url.pathname.startsWith('/_next/static/') ? route.continue() : route.abort() })
  try {
    assert(stylesheets.size, 'No real built stylesheets captured for component rendering')
    await page.setContent(`<html><head>${[...stylesheets].map(href => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><main style="padding:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px 16px">${html}</main></body></html>`)
    await page.evaluate(() => document.fonts.ready)
    const metrics = await page.locator('[data-card-case]').evaluateAll(cards => cards.map(card => {
      const r = card.getBoundingClientRect(), rect = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height } }
      const selectors = '.appointment-payment-symbol,.appointment-code,[data-service-color-star],[data-client-staff-choice],[data-duo-marker]'
      const markers = [...card.querySelectorAll(selectors)].map(el => ({ label: el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim(), ...rect(el) }))
      const fields = [...card.querySelectorAll('[data-card-time],[data-card-name],[data-care-state],[data-card-service]')].filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height).map(el => ({ text: el.textContent, ...rect(el) }))
      const inside = b => b.width > 0 && b.height > 0 && b.x >= r.left - 1 && b.right <= r.right + 1 && b.y >= r.top - 1 && b.bottom <= r.bottom + 1
      return { key: card.getAttribute('data-card-case'), card: rect(card), markers, fields, clipped: [...markers, ...fields].filter(b => !inside(b)), overlap: markers.some((a, i) => markers.slice(i + 1).some(b => a.x < b.right - .2 && a.right > b.x + .2 && a.y < b.bottom - .2 && a.bottom > b.y + .2)) }
    }))
    results.cardCases = metrics
    await shot(page, 'planning-fit-card-cases-111-120-150')
    for (const metric of metrics) { assert.equal(metric.markers.length, 7, `Marker count ${metric.key}`); assert.equal(metric.clipped.length, 0, `Clipped marker/text ${metric.key}`); assert(!metric.overlap, `Overlapping marker ${metric.key}`) }
    console.log('PASS exact card widths111/120/150 heights22/44/64/84')
  } catch (error) { results.failures.push({ kind: 'card-cases', message: error.message }); await shot(page, 'planning-fit-card-cases-failure'); console.log(`FAIL exact card cases: ${error.message}`) }
  finally { await context.close() }
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
    for (const width of widths) for (const count of [10, 12]) for (const kind of ['salon', 'global']) await runCase(browser, width, count, kind)
    if (!args['skip-phone']) await phoneCase(browser)
    if (!args['skip-card-cases']) await cardCases(browser)
    if (!args['skip-views']) for (const width of [820, 1536]) await overviewCase(browser, width)
  }
  finally {
    await browser.close()
    results.browserClosed = true; results.pass = results.failures.length === 0
    fs.mkdirSync(outDir, { recursive: true })
    for (const item of captures) fs.writeFileSync(path.join(outDir, item.name), item.bytes)
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2))
  }
  console.log(JSON.stringify({ pass: results.pass, cases: results.cases.length, failures: results.failures }, null, 2))
  if (!results.pass) process.exitCode = 1
}
module.exports = { origin, contextFor, fixture, time, id, salonId, day, services }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
