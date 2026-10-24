// Executes the production routes and booking/conflict code against an in-memory
// PostgREST adapter. No network, credentials, or production records are used.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const salonId = uuid(1), serviceId = uuid(2), staffIds = [uuid(3), uuid(4)]
const start = '2099-11-02T10:00:00.000Z', end = '2099-11-02T11:00:00.000Z'
let tables, failedUpdate = false, authDenied = false, sequence = 100
const stripeRequests = []

function seed(count) {
  failedUpdate = authDenied = false
  tables = {
    salons: [{ id: salonId, slug: 'test', name: 'Test', opening_hours: Object.fromEntries(
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => [day, { open: '09:00', close: '19:00' }])) }],
    services: [{ id: serviceId, duration_minutes: 60, required_staff_count: count, price_cents: 10000 }],
    service_salons: [{ service_id: serviceId, salon_id: salonId }],
    staff: staffIds.map(id => ({ id, salon_id: salonId, is_active: true, role: 'therapist' })),
    staff_services: [], staff_availability: [],
    appointments: [{ id: uuid(10), salon_id: salonId, service_id: serviceId, staff_id: staffIds[0], start_time: start, end_time: end, status: 'confirmed' }],
    appointment_assignments: staffIds.slice(0, count).map(staff_id => ({ appointment_id: uuid(10), staff_id })),
  }
}

function from(table) {
  assert.ok(tables[table], `Unexpected table ${table}`)
  let predicates = [], selection = '', operation, values, maximum
  const valueAt = (row, key) => key.split('.').reduce((value, part) => value?.[part], row)
  const compare = (key, op, value) => {
    predicates.push(row => {
      const actual = valueAt(row, key)
      if (op === 'in') return value.includes(actual)
      if (op === 'eq') return actual === value
      if (op === 'neq') return actual !== value
      if (op === 'lt') return actual < value
      if (op === 'gt') return actual > value
      if (op === 'gte') return actual >= value
      if (op === 'lte') return actual <= value
      throw new Error(`Unexpected operator ${op}`)
    })
    return q
  }
  const decorate = row => table === 'appointment_assignments'
    ? { ...row, appointment: tables.appointments.find(a => a.id === row.appointment_id) }
    : table === 'appointments'
      ? { ...row, assignments: tables.appointment_assignments.filter(a => a.appointment_id === row.id) }
      : { ...row }
  function execute(single = false) {
    if (operation === 'update' && failedUpdate) return { data: null, error: { message: 'Database unavailable' } }
    let rows = tables[table].filter(row => {
      const decorated = decorate(row)
      return (!selection.includes('!inner') || decorated.appointment) && predicates.every(test => test(decorated))
    })
    if (operation === 'insert') {
      rows = (Array.isArray(values) ? values : [values]).map(row => ({ id: uuid(sequence++), ...row }))
      tables[table].push(...rows)
    } else if (operation === 'update') rows.forEach(row => Object.assign(row, values))
    else if (operation === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row))
    if (maximum) rows = rows.slice(0, maximum)
    const data = rows.map(decorate)
    return single ? { data: data[0] || null, error: data.length === 1 ? null : { message: 'Row not found' } } : { data, error: null }
  }
  const q = {
    select(s = '') { selection = s; return q },
    eq: (k, v) => compare(k, 'eq', v), neq: (k, v) => compare(k, 'neq', v),
    in: (k, v) => compare(k, 'in', v), lt: (k, v) => compare(k, 'lt', v),
    gt: (k, v) => compare(k, 'gt', v), gte: (k, v) => compare(k, 'gte', v), lte: (k, v) => compare(k, 'lte', v),
    filter(k, op, v) { return compare(k, op, op === 'in' ? v.slice(1, -1).split(',').map(s => s.replaceAll('"', '')) : v) },
    or() { assert.equal(tables[table].length, 0, 'Fixtures do not support OR'); return q },
    limit(n) { maximum = n; return q },
    update(v) { operation = 'update'; values = v; return q },
    insert(v) { operation = 'insert'; values = v; return q },
    delete() { operation = 'delete'; return q },
    single: async () => execute(true),
    then(resolve, reject) { return Promise.resolve().then(() => execute()).then(resolve, reject) },
  }
  return q
}
const db = { from }
const modules = new Map()
function load(relative) {
  const filename = path.join(root, relative)
  if (modules.has(filename)) return modules.get(filename).exports
  const mod = { exports: {} }
  modules.set(filename, mod)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports: mod.exports, console: { log() {}, error() {} },
    require(name) {
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => db }
      if (name === '@/lib/stripe') return { getStripeClient: () => ({ checkout: { sessions: { create: async request => {
        stripeRequests.push(request)
        return { id: 'checkout-test', url: 'https://checkout.example.test/session' }
      } } } }) }
      if (name === '@/lib/gift-cards') return { getBaseUrl: () => 'https://example.test' }
      if (name === '@/lib/auth/api-auth') return { requireStaffAuth: () => authDenied ? { response: { status: 401 } } : { payload: { role: 'admin' } } }
      if (name === '@/lib/client-auth') return { findClientByEmail() { throw new Error('Unexpected client lookup') }, findClientByPhone() { throw new Error('Unexpected client lookup') } }
      if (name === 'next/server') return { NextResponse: { json: (data, init) => ({ data, status: init?.status || 200 }) } }
      return name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name)
    },
  }, { filename })
  return mod.exports
}
const patch = load('app/api/appointments/[id]/route.ts').PATCH
const serviceAvailability = load('app/api/availability/service/[service_id]/route.ts').GET
const staffAvailability = load('app/api/availability/[staff_id]/route.ts').GET
const { createBookableAppointment } = load('lib/appointments/create.ts')
const change = (body, id = uuid(10)) => patch({ json: async () => body }, { params: Promise.resolve({ id }) })
const input = count => ({ salon_id: salonId, service_id: serviceId, staff_id: staffIds[0], staff_ids: staffIds.slice(0, count), client_id: uuid(20), start_time: start })
async function isAvailable(count) {
  const response = await serviceAvailability({ nextUrl: new URL(`http://test?date=2099-11-02&salon_id=${salonId}&staff_ids=${staffIds.slice(0, count).join(',')}`) }, { params: Promise.resolve({ service_id: serviceId }) })
  assert.equal(response.status, 200)
  return response.data.available_slots.some(slot => slot.start === start)
}
async function staffIsAvailable(staff_id) {
  const response = await staffAvailability({ nextUrl: new URL(`http://test?date=2099-11-02&service_id=${serviceId}`) }, { params: Promise.resolve({ staff_id }) })
  assert.equal(response.status, 200)
  return response.data.available_slots.some(slot => slot.start === start)
}

async function main() {
  for (const count of [1, 2]) {
    seed(count)
    assert.equal(await isAvailable(count), false)
    for (const staff of staffIds.slice(0, count)) assert.equal(await staffIsAvailable(staff), false)
    await assert.rejects(() => createBookableAppointment(db, input(count)), /disponibles/)
    const original = { ...tables.appointments[0] }
    const cancelled = await change({ status: 'cancelled', salon_id: '', service_id: '', staff_ids: [] })
    assert.equal(cancelled.status, 200)
    assert.equal(tables.appointments[0].status, 'cancelled')
    assert.equal(tables.appointments[0].start_time, original.start_time)
    assert.equal(tables.appointments[0].end_time, original.end_time)
    assert.equal(tables.appointment_assignments.length, count, 'History must remain intact')
    assert.equal(await isAvailable(count), true)
    for (const staff of staffIds.slice(0, count)) assert.equal(await staffIsAvailable(staff), true)
    const replacement = await createBookableAppointment(db, input(count))
    assert.ok(replacement.id)
    assert.equal(await isAvailable(count), false)
    const reactivation = await change({ status: 'confirmed' })
    assert.notEqual(reactivation.status, 200)
    assert.equal(tables.appointments[0].status, 'cancelled')
    assert.equal((await change({ status: 'cancelled' })).status, 200)
    console.log(`PASS: ${count} staff — occupied -> cancel -> available in both APIs -> rebook -> occupied; conflicting reactivation refused`)
  }
  seed(1)
  failedUpdate = true
  assert.notEqual((await change({ status: 'cancelled' })).status, 200)
  assert.equal(tables.appointments[0].status, 'confirmed')
  assert.equal(await isAvailable(1), false)
  console.log('PASS: failed cancellation never reports success or releases the slot')
  seed(1)
  authDenied = true
  assert.equal((await change({ status: 'cancelled' })).status, 401)
  assert.equal(tables.appointments[0].status, 'confirmed')
  console.log('PASS: unauthorized cancellation leaves the booking intact')
  seed(1)
  assert.equal((await change({ status: 'confirmed', staff_ids: [] })).status, 400)
  assert.equal(tables.appointments[0].staff_id, staffIds[0])
  console.log('PASS: empty staff selection rejected without changing assignments')
  seed(1)
  await change({ status: 'cancelled' })
  tables.services[0].duration_minutes = 90
  assert.equal((await change({ status: 'confirmed' })).status, 200)
  assert.equal(tables.appointments[0].end_time, end)
  console.log('PASS: reactivation preserves the original booked duration')
  seed(2)
  tables.appointments.push({ ...tables.appointments[0], id: uuid(30), staff_id: staffIds[1] })
  await change({ status: 'cancelled' })
  assert.equal(await staffIsAvailable(staffIds[0]), true)
  assert.equal(await staffIsAvailable(staffIds[1]), false)
  assert.equal(await isAvailable(2), false)
  await assert.rejects(() => createBookableAppointment(db, input(2)), /disponibles/)
  console.log('PASS: cancellation preserves another booking that still occupies one practitioner')

  seed(1)
  tables.appointments[0].status = 'cancelled'
  Object.assign(tables.services[0], { name: 'Massage 60 minutes', is_active: true })
  const extraId = uuid(50)
  tables.services.push({ id: extraId, name: 'Massage 30 minutes', duration_minutes: 30, required_staff_count: 1, price_cents: 4000, is_active: true })
  tables.service_salons.push({ service_id: extraId, salon_id: salonId })
  const selected = { ...input(1), service_ids: [serviceId, extraId], expected_price_cents: 14000 }
  const validate = load('lib/appointments/create.ts').validateBookableAppointment
  const bundle = await validate(db, selected)
  assert.equal(bundle.service.price_cents, 14000)
  assert.equal(bundle.service.duration_minutes, 90)
  assert.equal(bundle.endTime, '2099-11-02T11:30:00.000Z')
  const bundleAvailability = () => serviceAvailability({ nextUrl: new URL(`http://test/api?salon_id=${salonId}&date=2099-11-02&service_ids=${serviceId},${extraId}`) }, { params: Promise.resolve({ service_id: serviceId }) })
  const availableBundle = await bundleAvailability()
  assert.equal(availableBundle.status, 200)
  assert.equal(availableBundle.data.service_duration_minutes, 90)
  assert.ok(availableBundle.data.available_slots.some(slot => slot.start === start && slot.end === bundle.endTime))
  tables.stripe_checkout_sessions = []
  const checkout = load('app/api/stripe/checkout/appointment/route.ts').POST
  const checkoutResponse = await checkout({ json: async () => ({ ...selected, _service_quote: [{ price_cents: 1 }] }), nextUrl: new URL('https://example.test') })
  assert.equal(checkoutResponse.status, 200)
  assert.equal(stripeRequests.length, 1)
  assert.equal(stripeRequests[0].line_items.length, 2)
  assert.equal(stripeRequests[0].line_items.reduce((sum, line) => sum + line.price_data.unit_amount, 0), 14000)
  assert.equal(tables.stripe_checkout_sessions[0].payload._service_quote.length, 2, 'Client-supplied quotes must not override the server quote')
  assert.equal(tables.stripe_checkout_sessions[0].amount_cents, 14000)
  const unavailableMigrationDb = { from(table) {
    const query = from(table), select = query.select
    query.select = fields => table === 'appointments' && fields === 'service_items'
      ? { limit: async () => ({ error: { message: 'Column not found' } }) } : select(fields)
    return query
  } }
  await assert.rejects(() => validate(unavailableMigrationDb, selected), /pas encore activées/)
  await assert.rejects(() => validate(db, { ...selected, expected_price_cents: 10000 }), /tarif/)
  await assert.rejects(() => validate(db, { ...selected, end_time: end }), /durée/)
  await assert.rejects(() => validate(db, { ...selected, service_ids: [serviceId, extraId, extraId] }), /invalide/)
  await assert.rejects(() => validate(db, { ...selected, payment_method: 'pack' }), /plusieurs prestations/)
  tables.services[1].required_staff_count = 2
  await assert.rejects(() => validate(db, selected), /même nombre/)
  tables.services[1].required_staff_count = 1
  tables.staff_services.push({ service_id: extraId, staff_id: staffIds[1] })
  await assert.rejects(() => validate(db, selected), /réaliser/)
  const qualifiedBundle = await bundleAvailability()
  assert.ok(qualifiedBundle.data.available_slots.length > 0)
  assert.ok(qualifiedBundle.data.available_slots.every(slot => !slot.available_staff.includes(staffIds[0])))
  tables.staff_services = []
  tables.appointments.push({ ...tables.appointments[0], id: uuid(60), status: 'confirmed', start_time: '2099-11-02T11:00:00.000Z', end_time: '2099-11-02T12:00:00.000Z' })
  await assert.rejects(() => validate(db, selected), /disponibles/)
  const remainingSlot = (await bundleAvailability()).data.available_slots.find(slot => slot.start === start)
  assert.ok(!remainingSlot || !remainingSlot.available_staff.includes(staffIds[0]))
  tables.appointments.pop()
  const combined = await createBookableAppointment(db, selected)
  assert.equal(combined.service.price_cents, 14000)
  assert.equal(combined.service_items.length, 2)
  assert.equal(combined.end_time, '2099-11-02T11:30:00.000Z')
  tables.appointments.pop()
  tables.services[1].price_cents = 8000
  tables.services[1].duration_minutes = 60
  const quoted = await validate(db, { ...selected, expected_price_cents: undefined }, bundle.serviceItems)
  assert.equal(quoted.service.price_cents, 14000, 'A paid Stripe quote keeps the charged price')
  assert.equal(quoted.endTime, bundle.endTime, 'A paid Stripe quote keeps the reserved duration')
  console.log('PASS: 60+30 min reserves 90 min; total price, full-duration conflicts, qualifications, duplicate services and incompatible pack/team choices verified')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
