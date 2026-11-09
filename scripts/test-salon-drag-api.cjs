// Execute the real salon-only routes, authorization helper and auth gate.
// Supabase and JWT verification are isolated fixtures: no network or production data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const salonId = id(1), appointmentId = id(2), actorId = id(3), destinationStaff = id(4), requestId = id(5)
const plain = value => JSON.parse(JSON.stringify(value))
const before = '2099-11-02T10:00:00.000Z', after = '2099-11-02T13:00:00.000Z'
const version = '2026-11-09T10:00:00.000Z'
const validBody = () => ({ start_time: after, staff_ids: [destinationStaff], expected_updated_at: version, request_id: requestId })
const context = (params = {}) => ({ params: Promise.resolve({ salonId, id: appointmentId, ...params }) })
const result = () => ({
  appointment: { id: appointmentId, start_time: after, updated_at: '2026-11-09T11:00:00.000Z' },
  change: { id: id(100), changes: { before: { start_time: before } } }, replayed: false,
})
let state
function seed(options = {}) {
  state = {
    payload: { staffId: actorId, salonId, email: 'local@example.test', role: 'admin' },
    actor: { id: actorId, salon_id: salonId, role: 'admin', is_active: true },
    clients: 0, queries: [], rpcCalls: [], directWrites: [], syncCalls: [],
    rpcData: result(), rpcError: null, staffError: null, journalError: null, logs: [], ...options,
  }
  return state
}
function field(row, key) { return key === 'changes->>source' ? row.changes?.source : row[key] }
function from(table) {
  const trace = { table, select: undefined, filters: [], orders: [], limit: undefined, or: undefined }
  state.queries.push(trace)
  const predicates = []
  const execute = single => {
    const error = table === 'staff' ? state.staffError : state.journalError
    if (error) return { data: null, error }
    let rows = table === 'staff' ? (state.actor ? [state.actor] : []) : table === 'activity_logs' ? [...state.logs] : []
    rows = rows.filter(row => predicates.every(test => test(row)))
    rows.sort((left, right) => {
      for (const [key, options] of trace.orders) {
        const a = key === 'created_at' ? Date.parse(left[key]) : left[key]
        const b = key === 'created_at' ? Date.parse(right[key]) : right[key]
        if (a !== b) return (a < b ? -1 : 1) * (options.ascending ? 1 : -1)
      }
      return 0
    })
    if (trace.limit !== undefined) rows = rows.slice(0, trace.limit)
    if (trace.select) rows = rows.map(row => Object.fromEntries(trace.select.split(',').map(key => key.trim()).map(key => [key, row[key]])))
    return { data: single ? rows[0] || null : rows, error: null }
  }
  const query = {
    select(columns) { trace.select = columns; return query },
    eq(key, value) { trace.filters.push([key, value]); predicates.push(row => field(row, key) === value); return query },
    order(key, options) { trace.orders.push([key, options]); return query },
    limit(value) { trace.limit = value; return query },
    or(expression) {
      trace.or = expression
      const match = /^created_at\.lt\.(.*),and\(created_at\.eq\.(.*),id\.lt\.([^)]*)\)$/.exec(expression)
      assert(match, `Unexpected journal cursor expression: ${expression}`)
      assert.equal(match[1], match[2], 'The tuple cursor must use one timestamp boundary')
      const at = Date.parse(match[1]), boundaryId = match[3]
      predicates.push(row => Date.parse(row.created_at) < at || (Date.parse(row.created_at) === at && row.id < boundaryId))
      return query
    },
    maybeSingle: async () => execute(true),
    then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject) },
  }
  for (const operation of ['insert', 'update', 'upsert', 'delete']) query[operation] = (...values) => {
    state.directWrites.push({ table, operation, values })
    throw new Error('A salon move must never fall back to direct writes')
  }
  return query
}
const db = {
  from,
  async rpc(name, payload) {
    state.rpcCalls.push({ name, payload: plain(payload) })
    if (state.rpcThrows) throw new Error('RPC transport unavailable')
    return { data: state.rpcData, error: state.rpcError }
  },
}
const modules = new Map()
function load(relative) {
  const filename = path.join(root, relative)
  if (modules.has(filename)) return modules.get(filename)
  const exports = {}
  modules.set(filename, exports)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Buffer, URL, Headers, Date, Error, TypeError,
    require(name) {
      if (name === 'next/server') return { NextResponse: { json(data, init = {}) { return { data, status: init.status || 200 } } } }
      if (name === '@/lib/supabase/admin') return { createAdminClient() { state.clients++; return db } }
      if (name === '@/lib/auth/jwt') return { verifyToken(token) { return token === 'local-valid-session' ? state.payload : null } }
      if (name === '@/lib/sync/trigger') return { syncAfterBookingChange: (...args) => state.syncCalls.push(args) }
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts')
      return require(name)
    },
  }, { filename })
  return exports
}
function request(body = validBody(), options = {}) {
  const headers = new Headers(options.bearer ? { Authorization: `Bearer ${options.bearer}` } : {})
  return {
    headers,
    cookies: { get(name) { return !options.noCookie && name === 'accessToken' ? { value: options.token || 'local-valid-session' } : undefined } },
    nextUrl: new URL(`https://example.test/api/admin/salons/${salonId}/appointment-moves${options.query || ''}`),
    json: async () => { if (options.invalidJSON) throw new SyntaxError('Bad JSON'); return body },
  }
}
function noMutation() {
  assert.equal(state.rpcCalls.length, 0)
  assert.equal(state.directWrites.length, 0)
  assert.equal(state.syncCalls.length, 0)
}
function singleAtomicMutation() {
  assert.equal(state.rpcCalls.length, 1)
  assert.equal(state.directWrites.length, 0)
  assert.equal(state.rpcCalls[0].name, 'salon_drag_appointment_atomic')
  assert.deepEqual(state.rpcCalls[0].payload, {
    p_salon_id: salonId, p_appointment_id: appointmentId, p_expected_updated_at: version,
    p_start_time: after, p_staff_ids: [destinationStaff], p_actor_id: actorId, p_request_id: requestId,
  })
}

async function main() {
  const moveRoute = load('app/api/admin/salons/[salonId]/appointments/[id]/move/route.ts')
  const journalRoute = load('app/api/admin/salons/[salonId]/appointment-moves/route.ts')
  const helper = load('lib/appointments/salon-moves.ts')
  const call = async (kind, options = {}) => kind === 'POST'
    ? moveRoute.POST(request(options.body, options.request), context(options.params))
    : journalRoute.GET(request(undefined, options.request), context(options.params))

  for (const kind of ['POST', 'GET']) {
    for (const auth of [{ noCookie: true }, { token: 'invalid-session' }]) {
      seed(); assert.equal((await call(kind, { request: auth })).status, 401); noMutation(); assert.equal(state.clients, 0)
    }
    seed({ actor: null })
    assert.equal((await call(kind)).status, 403, kind + ' rechecks that the authenticated staff account still exists')
    noMutation()
    assert.deepEqual(state.queries[0].filters, [['id', actorId]])
    for (const role of ['admin', 'manager', 'receptionist', 'assistant', 'therapist']) {
      for (const actorSalon of [salonId, id(999)]) {
        for (const isActive of [true, false, null]) {
          seed(); state.payload.role = role; state.actor.role = role; state.actor.salon_id = actorSalon; state.actor.is_active = isActive
          assert.equal((await call(kind)).status, 200, role + ' has planning access regardless of whether the account is bookable or assigned to this salon')
        }
      }
    }
    seed({payload:{clientId:id(999),role:'client'},actor:null})
    assert.equal((await call(kind)).status,403);noMutation()
    seed({payload:{staffId:actorId,clientId:id(999),role:'client'}})
    assert.equal((await call(kind)).status,403, 'A client session is not an operator session even if it carries a staff-shaped identifier');noMutation()
    seed({actor:{id:actorId,salon_id:salonId,role:'client',is_active:true}})
    assert.equal((await call(kind)).status,403, 'The database identity must still be a staff role');noMutation()
    seed({ staffError: { message: 'Database access failed' } })
    assert.equal((await call(kind)).status, 500); noMutation()
  }
  seed(); assert.equal(await helper.authorizeSalonMove(db, state.payload, salonId), true)
  state.actor.id = id(999); assert.equal(await helper.authorizeSalonMove(db, state.payload, salonId), false)
  console.log('PASS: every authenticated staff role can move and read the journal even when not bookable; anonymous, client and missing staff accounts remain refused')

  const forbidden = {
    service_id: id(40), status: 'cancelled', payment_status: 'paid', payment_method: 'cash', amount_paid_cents: 0,
    end_time: '2099-11-02T16:00:00.000Z', duration_minutes: 180, client_id: id(41), salon_id: id(42), actor_id: id(43), force: true,
  }
  for (const [key, value] of Object.entries(forbidden)) {
    seed(); assert.equal((await call('POST', { body: { ...validBody(), [key]: value } })).status, 400, `${key} must not enter the move RPC`)
    noMutation(); assert.equal(state.clients, 0)
  }
  for (const body of [null, {}, { ...validBody(), expected_updated_at: null }, { ...validBody(), expected_updated_at: 'invalid' },
    { ...validBody(), start_time: 'invalid' }, { ...validBody(), staff_ids: [] },
    { ...validBody(), staff_ids: [destinationStaff, destinationStaff] }, { ...validBody(), staff_ids: ['invalid'] },
    { ...validBody(), staff_ids: Array.from({ length: 21 }, (_, index) => id(500 + index)) }, { ...validBody(), request_id: 'invalid' },
  ]) {
    seed(); assert.equal((await call('POST', { body })).status, 400); noMutation()
  }
  seed(); assert.equal((await call('POST', { request: { invalidJSON: true } })).status, 400); noMutation()
  for (const params of [{ salonId: 'invalid' }, { id: 'invalid' }]) {
    seed(); assert.equal((await call('POST', { params })).status, 400); noMutation(); assert.equal(state.clients, 0)
  }
  console.log('PASS: injected service/status/payment/duration/identity fields, malformed JSON, duplicate teams and invalid versions or params are rejected before any RPC')

  seed()
  let response = await call('POST')
  assert.equal(response.status, 200)
  singleAtomicMutation()
  assert.deepEqual(plain(response.data), { id: appointmentId, updated_at: result().appointment.updated_at, change_id: id(100), replayed: false })
  assert.deepEqual(state.syncCalls, [['salon-drag', before, after]])
  seed(); response = await call('POST', { request: { noCookie: true, bearer: 'local-valid-session' } })
  assert.equal(response.status, 200); singleAtomicMutation()
  seed({ rpcData: { ...result(), replayed: true } })
  response = await call('POST'); assert.equal(response.status, 200); assert.equal(response.data.replayed, true)
  singleAtomicMutation(); assert.equal(state.syncCalls.length, 0, 'An idempotent replay must not resync the booking')
  for (const rpcData of [null, {}, { appointment: result().appointment }, { change: result().change },
    { appointment: {}, change: result().change }, { appointment: result().appointment, change: {} },
  ]) {
    seed({ rpcData }); assert.equal((await call('POST')).status, 502); singleAtomicMutation(); assert.equal(state.syncCalls.length, 0)
  }
  for (const [code, expected] of [['PT409', 409], ['40001', 409], ['23505', 409], ['42883', 503], ['PGRST202', 503], ['42501', 403], ['P0002', 404], ['22023', 400]]) {
    seed({ rpcError: { code, message: 'RPC refused the move' }, rpcData: null })
    response = await call('POST'); assert.equal(response.status, expected, code)
    if (code === 'PT409' || code === '40001') assert.equal(response.data.error, 'RPC refused the move', 'Business and database conflicts keep their useful error message')
    singleAtomicMutation(); assert.equal(state.syncCalls.length, 0)
  }
  seed({ actor: { id: actorId, role: 'receptionist', salon_id: id(999), is_active: false },
    rpcError: { code: '22023', message: 'Choisissez des masseuses actives de ce salon.' }, rpcData: null })
  response = await call('POST')
  assert.equal(response.status, 400, 'A non-bookable operator is authorized, but an inactive destination remains refused by the atomic move')
  assert.match(response.data.error, /masseuses actives/)
  singleAtomicMutation(); assert.equal(state.syncCalls.length, 0)
  seed({ rpcThrows: true }); assert.equal((await call('POST')).status, 500); singleAtomicMutation(); assert.equal(state.syncCalls.length, 0)
  console.log('PASS: one seven-argument actor-bound RPC is the only write path; PT409 and real serialization failures map to 409, replays skip sync, and failures never fall back')

  for (const options of [
    { params: { salonId: 'invalid' } }, { request: { query: '?limit=0' } }, { request: { query: '?limit=51' } },
    { request: { query: '?limit=1.5' } }, { request: { query: '?limit=invalid' } },
    { request: { query: '?before=not-base64-json' } },
    { request: { query: '?before=' + Buffer.from(JSON.stringify({ at: 'invalid', id: id(8) })).toString('base64url') } },
    { request: { query: '?before=' + Buffer.from(JSON.stringify({ at: version, id: 'invalid' })).toString('base64url') } },
    { request: { query: '?before=' + 'a'.repeat(151) } },
  ]) {
    seed(); assert.equal((await call('GET', options)).status, 400); noMutation(); assert.equal(state.clients, 0)
  }
  const log = (number, at = '2026-11-09T14:00:00.000Z', patch = {}) => ({
    id: id(number), created_at: at, actor_id: actorId, entity_id: appointmentId,
    salon_id: salonId, action_type: 'salon_appointment_moved', entity_type: 'appointment',
    changes: { source: 'salon_drag', request_id: id(number + 1000), before: { start_time: before }, after: { start_time: after } }, ...patch,
  })
  const logs = [log(48), log(50), log(49), log(47, '2026-11-09T13:00:00.000Z'), log(46, '2026-11-09T12:00:00.000Z'),
    log(90, '2026-11-09T15:00:00.000Z', { salon_id: id(999) }),
    log(91, '2026-11-09T15:00:00.000Z', { action_type: 'another_action' }),
    log(92, '2026-11-09T15:00:00.000Z', { entity_type: 'client' }),
    log(93, '2026-11-09T15:00:00.000Z', { changes: { source: 'another_screen' } }),
  ]
  seed({ logs })
  response = await call('GET', { request: { query: '?limit=2' } })
  assert.equal(response.status, 200)
  assert.deepEqual(Array.from(response.data.entries, entry => entry.id), [id(50), id(49)])
  let cursor = response.data.next_cursor
  assert.deepEqual(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')), { at: '2026-11-09T14:00:00.000Z', id: id(49) })
  const journalQuery = state.queries.find(query => query.table === 'activity_logs')
  assert.deepEqual(journalQuery.filters, [['salon_id', salonId], ['action_type', 'salon_appointment_moved'], ['entity_type', 'appointment'], ['changes->>source', 'salon_drag']])
  assert.deepEqual(plain(journalQuery.orders), [['created_at', { ascending: false }], ['id', { ascending: false }]])
  assert.equal(journalQuery.limit, 3, 'Fetch one extra row to determine whether another page exists')
  assert.deepEqual(Object.keys(response.data.entries[0]).sort(), ['actor_id', 'changes', 'created_at', 'entity_id', 'id'])
  response = await call('GET', { request: { query: '?limit=2&before=' + cursor } })
  assert.deepEqual(Array.from(response.data.entries, entry => entry.id), [id(48), id(47)], 'Equal timestamps must paginate by the secondary ID')
  cursor = response.data.next_cursor
  response = await call('GET', { request: { query: '?limit=2&before=' + cursor } })
  assert.deepEqual(Array.from(response.data.entries, entry => entry.id), [id(46)])
  assert.equal(response.data.next_cursor, null)
  noMutation()
  seed(); response = await call('GET'); assert.deepEqual(plain(response.data), { entries: [], next_cursor: null }); noMutation()
  seed({ journalError: { message: 'Unavailable' } }); assert.equal((await call('GET')).status, 500); noMutation()
  console.log('PASS: the journal is salon/action/entity/source scoped, read-only, validates cursors and paginates equal timestamps without leaking or skipping rows')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
