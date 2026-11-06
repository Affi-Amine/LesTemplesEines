// Planning rules: cancelled/absent traces, blocked slot edits, counters, and the
// payment side of changing a booking's prestation. Pure modules and the real
// PATCH/DELETE route against an in-memory database; no network.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

const root = path.resolve(__dirname, "..")
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const plain = (value) => JSON.parse(JSON.stringify(value))

function load(file, stubs = {}, cache = new Map()) {
  const filename = path.join(root, file)
  if (cache.has(filename)) return cache.get(filename).exports
  const mod = { exports: {} }
  cache.set(filename, mod)
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, {
    exports: mod.exports, console, Date, Intl, URL,
    require(name) {
      if (stubs[name]) return stubs[name]
      // The platform-sync side effects are fired through after(); they are not part of the planning rules.
      if (name === "@/lib/sync/trigger") return { syncAfterBookingChange: () => {}, loadRemoteCopies: async () => [], cancelRemoteCopiesAfterDelete: () => {} }
      if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`, stubs, cache)
      return require(name)
    },
  }, { filename })
  return mod.exports
}

// ---- prestation change: what happens to the payment ------------------------

const { planServiceChangePayment: plan } = load("lib/appointments/service-change.ts")
const change = (appointment, priceCents, extra = {}) =>
  plain(plan({ appointment, previousPriceCents: 3500, priceCents, serviceId: "thai-90", ...extra }))

let result = change({ payment_status: "unpaid", payment_method: "on_site", amount_paid_cents: 0 }, 6500)
assert.deepEqual([result.due_cents, result.overpaid_cents, result.updates], [6500, 0, {}])
result = change({ payment_status: "paid", payment_method: "card", amount_paid_cents: 3500 }, 6500)
assert.deepEqual([result.due_cents, result.overpaid_cents, result.updates], [3000, 0, { payment_status: "partial" }])
result = change({ payment_status: "paid", payment_method: "stripe", amount_paid_cents: 6500 }, 3500)
assert.deepEqual([result.due_cents, result.overpaid_cents, result.updates], [0, 3000, {}])
result = change({ payment_status: "partial", payment_method: "cash", amount_paid_cents: 3500 }, 3500)
assert.deepEqual([result.due_cents, result.updates], [0, { payment_status: "paid" }])
console.log("PASS: dearer prestation leaves a supplement (partial), cheaper one an overpayment, unpaid stays unpaid")

result = change({ payment_status: "paid", payment_method: "pack", amount_paid_cents: 3500 }, 6500, { packAllowedServiceIds: ["thai-60", "thai-90"] })
assert.deepEqual([result.covered_by_pack, result.due_cents, result.updates], [true, 0, {}])
assert.throws(() => change({ payment_status: "paid", payment_method: "pack" }, 6500, { packAllowedServiceIds: ["thai-60"] }), (e) => e.status === 422 && /forfait/.test(e.message))
assert.throws(() => change({ payment_status: "pending", payment_method: "stripe" }, 6500), (e) => e.status === 409 && /en ligne/.test(e.message))
console.log("PASS: a pack covers its own prestations for free and refuses others; a pending online payment blocks the change")

// ---- planning display -------------------------------------------------------

const scheduling = load("lib/calendar/scheduling.ts")
for (const status of ["blocked", "cancelled", "no_show"]) assert.equal(scheduling.isBookedAppointment(status), false)
for (const status of ["confirmed", "pending", "in_progress", "completed"]) assert.equal(scheduling.isBookedAppointment(status), true)
console.log("PASS: day counters count prestations only, not blocked slots or cancelled/absent traces")

const at = (h, m = 0) => `2099-11-02T${String(h - 1).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`
const live = { id: "live", status: "confirmed", start_time: at(14), end_time: at(15) }
const ghost = { id: "ghost", status: "cancelled", start_time: at(14), end_time: at(15) }
const absent = { id: "absent", status: "no_show", start_time: at(17), end_time: at(18) }
const lanes = scheduling.layoutAppointmentLanes([ghost, live, absent])
assert.deepEqual(plain(lanes.get("live")), { lane: 0, lanes: 2 })
assert.deepEqual(plain(lanes.get("ghost")), { lane: 1, lanes: 2 })
assert.deepEqual(plain(lanes.get("absent")), { lane: 0, lanes: 1 })
assert.equal(scheduling.findOverlappingAppointment({ appointments: [ghost], staffId: "a", start: new Date(at(14)), end: new Date(at(15)) }), null)
const hours = scheduling.getScheduleHoursIncludingAppointments({ monday: { open: "10:00", close: "20:00" } }, new Date("2099-11-02T12:00:00Z"),
  [{ id: "early", status: "cancelled", start_time: at(8), end_time: at(9) }])
assert.equal(hours[0], 8)
console.log("PASS: a cancelled booking stays visible beside the one that rebooked its slot, never blocks it, and keeps its hour on screen")

// ---- PATCH / DELETE route ---------------------------------------------------

function routeScenario({ existing, body, role = "admin", conflict = false, method = "PATCH", servicePriceCents = 6500, packServices = null }) {
  const calls = { rpc: [], writes: 0, availability: null, validation: null, deleted: false }
  const db = {
    from(table) {
      const q = {
        select() { return q }, eq() { return q }, in() { return q }, neq() { return q },
        single: async () => ({ data: existing, error: null }),
        maybeSingle: async () => table === "services" ? { data: { price_cents: 3500 }, error: null }
          : table === "client_packs" ? { data: { pack: { allowed_services: packServices } }, error: null } : { data: null, error: null },
        insert() { calls.writes++; return q }, update() { calls.writes++; return q },
        delete() { if (table === "appointments") calls.deleted = true; else calls.writes++; return q },
        then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve) },
      }
      return q
    },
    rpc: async (name, payload) => { calls.rpc.push({ name, payload }); return { data: { id: existing.id, ...payload.p_updates }, error: null } },
  }
  // One module cache, so the stub throws the very SchedulingError class the route checks for.
  const cache = new Map()
  const { SchedulingError } = load("lib/appointments/rules.ts", {}, cache)
  const route = load("app/api/appointments/[id]/route.ts", {
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/auth/api-auth": { requireStaffAuth: (_request, roles) => roles.includes(role) ? { payload: { role } } : { response: { status: 403 } } },
    "@/lib/appointments/create": {
      validateAppointmentScheduling: async (_db, data) => {
        calls.validation = data
        return { endTime: new Date(Date.parse(data.start_time) + 90 * 60_000).toISOString(), service: { price_cents: servicePriceCents } }
      },
      assertStaffAvailable: async (_db, ...args) => {
        calls.availability = args
        if (conflict) throw new SchedulingError("Un ou plusieurs créneaux ne sont plus disponibles", 409)
      },
    },
    "@/lib/appointments/service-selection": { presentAppointmentServices: (value) => value },
    "next/server": { NextResponse: { json: (data, init) => ({ data, status: init?.status || 200 }) } },
  }, cache)
  const request = { json: async () => body }
  const run = method === "PATCH" ? route.PATCH(request, { params: Promise.resolve({ id: existing.id }) }) : route.DELETE(request, { params: Promise.resolve({ id: existing.id }) })
  return run.then((response) => ({ response: plain(response), calls: plain(calls) }))
}

const booking = { id: id(1), status: "confirmed", salon_id: id(2), service_id: id(3), staff_id: id(4), assignments: [{ staff_id: id(4) }],
  start_time: "2099-11-02T13:00:00Z", end_time: "2099-11-02T14:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  payment_status: "paid", payment_method: "card", amount_paid_cents: 3500 }
const block = { id: id(9), status: "blocked", salon_id: id(2), service_id: null, staff_id: id(4), assignments: [{ staff_id: id(4) }],
  start_time: "2099-11-02T13:00:00Z", end_time: "2099-11-02T14:00:00Z", updated_at: "2026-01-01T00:00:00Z", client_notes: "Pause" }

;(async () => {
  let { response, calls } = await routeScenario({ existing: booking, body: { service_id: id(5), dry_run: true } })
  assert.equal(response.status, 200)
  assert.equal(response.data.dry_run, true)
  assert.equal(response.data.end_time, "2099-11-02T14:30:00.000Z")
  assert.deepEqual([response.data.payment.due_cents, response.data.payment.updates], [3000, { payment_status: "partial" }])
  assert.deepEqual([calls.rpc.length, calls.writes], [0, 0])
  console.log("PASS: dry run checks the slot and prices the change without writing anything")

  ;({ response, calls } = await routeScenario({ existing: booking, body: { service_id: id(5) } }))
  assert.equal(response.status, 200)
  assert.equal(calls.rpc.length, 1)
  assert.equal(calls.rpc[0].payload.p_updates.service_id, id(5))
  assert.equal(calls.rpc[0].payload.p_updates.payment_status, "partial")
  assert.equal(response.data.service_change_payment.due_cents, 3000)
  console.log("PASS: saving a dearer prestation marks the booking partly paid in the same atomic write")

  ;({ response } = await routeScenario({ existing: { ...booking, payment_method: "pack", client_pack_id: id(7) }, body: { service_id: id(5) }, packServices: [id(3)] }))
  assert.equal(response.status, 422)
  assert.match(response.data.error, /forfait/)
  console.log("PASS: a prestation outside the client's pack is refused")

  ;({ response, calls } = await routeScenario({ existing: block, body: { start_time: "2099-11-02T15:00:00.000Z", end_time: "2099-11-02T16:30:00.000Z", staff_ids: [id(6)], client_notes: "Formation" } }))
  assert.equal(response.status, 200)
  assert.equal(calls.validation, null)
  assert.deepEqual(calls.availability, [[id(6)], "2099-11-02T15:00:00.000Z", "2099-11-02T16:30:00.000Z", id(9)])
  assert.equal(calls.rpc[0].payload.p_updates.end_time, "2099-11-02T16:30:00.000Z")
  assert.deepEqual(calls.rpc[0].payload.p_staff_ids, [id(6)])
  console.log("PASS: a blocked slot can be moved, resized and reassigned, checked against the other bookings")

  ;({ response, calls } = await routeScenario({ existing: block, body: { end_time: "2099-11-02T15:00:00.000Z" }, conflict: true }))
  assert.equal(response.status, 409)
  assert.match(response.data.error, /blocage/)
  assert.equal(calls.rpc.length, 0)
  ;({ response } = await routeScenario({ existing: block, body: { end_time: "2099-11-02T12:00:00.000Z" } }))
  assert.equal(response.status, 400)
  console.log("PASS: a blocked slot cannot be stretched over a booking or end before it starts")

  ;({ response, calls } = await routeScenario({ existing: block, method: "DELETE", role: "therapist" }))
  assert.deepEqual([response.status, calls.deleted], [200, true])
  ;({ response, calls } = await routeScenario({ existing: booking, method: "DELETE", role: "therapist" }))
  assert.deepEqual([response.status, calls.deleted], [403, false])
  console.log("PASS: any staff member can lift a blocked slot; deleting a booking stays with the front desk")
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
