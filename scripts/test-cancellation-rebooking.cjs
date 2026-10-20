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
}
main().catch(error => { console.error(error); process.exitCode = 1 })
