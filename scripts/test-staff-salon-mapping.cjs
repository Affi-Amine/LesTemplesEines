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
const getStaff = load('app/api/staff/route.ts').GET
const { resolveSalonGroup } = load('lib/salons/resolve.ts')
async function main() {
  seed(1)
  const otherSalonId = uuid(50)
  tables.salons.push({ id: otherSalonId, name: 'Test', slug: 'other' })
  tables.staff[0].staff_services = [{ service_id: serviceId }]
  tables.staff.push({ id: uuid(51), salon_id: otherSalonId, first_name: 'Other',
    role: 'therapist', is_active: true, staff_services: [{ service_id: serviceId }] })
  tables.service_salons.push({ service_id: serviceId, salon_id: otherSalonId })
  for (const value of [salonId, 'test']) {
    const group = await resolveSalonGroup(db, value)
    assert.deepEqual(Array.from(group.salonIds), [salonId])
    const result = await getStaff({ nextUrl: new URL(`http://test?salon_id=${value}`) })
    assert.equal(result.status, 200)
    assert.deepEqual(Array.from(result.data, s => s.id), staffIds)
  }
  tables.salons[1].slug = 'test'
  assert.deepEqual(Array.from((await resolveSalonGroup(db, salonId)).salonIds), [salonId])
  await assert.rejects(() => resolveSalonGroup(db, 'test'), /ambigu/)
  tables.salons[1].slug = 'temple-Nuad '
  assert.equal((await resolveSalonGroup(db, ' temple-nuad ')).salon.id, otherSalonId)
  const all = await getStaff({ nextUrl: new URL('http://test') })
  assert.equal(all.data.length, 3)
  const missing = await getStaff({ nextUrl: new URL('http://test?salon_id=missing') })
  assert.equal(missing.status, 404)
  console.log('Salon staff isolation: shared service, name, slug and unfiltered list passed')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
