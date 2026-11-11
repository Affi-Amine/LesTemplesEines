// Three-way sync (site <-> Planity <-> Treatwell) against an in-memory database
// and two in-memory platform agendas. Runs lib/sync/engine.ts unchanged; only
// the Supabase client and the two platform adapters are replaced.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

const root = path.resolve(__dirname, "..")
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const DAY = 86_400_000
// Tomorrow 10:00 Paris (09:00Z in winter), so every booking is inside the window and in the future.
const base = new Date(Math.ceil(Date.now() / DAY) * DAY + 9 * 3_600_000)
const at = (hours, days = 1) => new Date(base.getTime() + (days - 1) * DAY + hours * 3_600_000).toISOString()

const SALON = id(1)
const [ALICE, BEA] = [id(2), id(3)]
const SERVICE = id(4)

// ---- in-memory Supabase ------------------------------------------------------

let tables
let sequence = 1000
const ACTIVE = ["confirmed", "pending", "in_progress"]

function resetDb() {
  tables = {
    salons: [{ id: SALON, name: "Le Temple Hanay ", is_active: true }],
    staff: [
      { id: ALICE, salon_id: SALON, first_name: "Madame", last_name: "Alice", is_active: true },
      { id: BEA, salon_id: SALON, first_name: "Madame", last_name: "Bea", is_active: true },
    ],
    services: [{ id: SERVICE, name: "Massage Thai 60 min", duration_minutes: 60, price_cents: 6000, is_active: true }],
    service_salons: [{ service_id: SERVICE, salon_id: SALON }],
    clients: [],
    appointments: [],
    appointment_assignments: [],
    appointment_platform_links: [],
    platform_mappings: [],
    platform_sync_runs: [],
  }
}

const now = () => new Date().toISOString()
const DEFAULTS = {
  appointments: () => ({ source: "site", created_at: now(), updated_at: now() }),
  appointment_platform_links: () => ({ external_ref: {}, synced_at: now(), created_at: now() }),
  platform_sync_runs: () => ({ status: "running", started_at: now() }),
}

function staffOf(appointment) {
  const assigned = tables.appointment_assignments.filter((a) => a.appointment_id === appointment.id).map((a) => a.staff_id)
  return new Set([appointment.staff_id, ...assigned].filter(Boolean))
}

/** Mirrors the database's no-double-booking guard (SQLSTATE 23P01). */
function overlapError(appointment) {
  if (!ACTIVE.includes(appointment.status)) return null
  const mine = staffOf(appointment)
  const clash = tables.appointments.find((other) => other.id !== appointment.id && ACTIVE.includes(other.status) &&
    Date.parse(other.start_time) < Date.parse(appointment.end_time) && Date.parse(other.end_time) > Date.parse(appointment.start_time) &&
    [...staffOf(other)].some((s) => mine.has(s)))
  return clash ? { code: "23P01", message: "conflicting key value violates exclusion constraint" } : null
}

function uniqueError(table, row) {
  if (table !== "appointment_platform_links") return null
  const dupe = tables[table].find((other) => other !== row && other.platform === row.platform &&
    (other.external_id === row.external_id || other.appointment_id === row.appointment_id))
  return dupe ? { code: "23505", message: "duplicate key value violates unique constraint" } : null
}

function withEmbeds(table, row, columns) {
  if (table !== "appointments" || !/assignments:/.test(columns)) return row
  return {
    ...row,
    client: tables.clients.find((c) => c.id === row.client_id) || null,
    service: tables.services.find((s) => s.id === row.service_id) || null,
    assignments: tables.appointment_assignments.filter((a) => a.appointment_id === row.id).map((a) => ({ staff_id: a.staff_id })),
  }
}

/** PostgREST truncates every response to 1000 rows; the engine must paginate. */
const SERVER_MAX_ROWS = 1000

function from(table) {
  const filters = []
  let operation = "select"
  let values
  let columns = "*"
  let limit = Infinity
  let slice = null
  const where = (check) => {
    filters.push(check)
    return query
  }
  const execute = (mode) => {
    let error = null
    let rows
    if (operation === "insert" || operation === "upsert") {
      rows = (Array.isArray(values) ? values : [values]).map((value) => ({ id: id(sequence++), ...(DEFAULTS[table]?.() || {}), ...value }))
      for (const row of rows) {
        tables[table].push(row)
        error = error || uniqueError(table, row) || (table === "appointments" ? overlapError(row) : null)
        if (error) tables[table].splice(tables[table].indexOf(row), 1)
      }
      if (table === "appointment_assignments" && !error) {
        for (const row of rows) {
          const appointment = tables.appointments.find((a) => a.id === row.appointment_id)
          error = error || (appointment ? overlapError(appointment) : null)
        }
        if (error) tables[table] = tables[table].filter((row) => !rows.includes(row))
      }
      if (error) return { data: null, error }
    } else {
      rows = tables[table].filter((row) => filters.every((check) => check(row)))
      if (operation === "update") {
        for (const row of rows) {
          const before = { ...row }
          Object.assign(row, values, table === "appointments" ? { updated_at: now() } : {})
          error = error || (table === "appointments" ? overlapError(row) : null)
          if (error) Object.assign(row, before)
        }
        if (error) return { data: null, error }
      }
      if (operation === "delete") {
        tables[table] = tables[table].filter((row) => !rows.includes(row))
        if (table === "appointments") tables.appointment_platform_links = tables.appointment_platform_links.filter((l) => !rows.some((r) => r.id === l.appointment_id))
      }
    }
    const page = slice ? rows.slice(slice[0], slice[1] + 1) : rows
    const data = page.slice(0, Math.min(limit, SERVER_MAX_ROWS)).map((row) => withEmbeds(table, structuredClone(row), columns))
    if (mode === "single") return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: `${data.length} rows` } }
    if (mode === "maybeSingle") return { data: data[0] || null, error: null }
    return { data, error: null }
  }
  const query = {
    select(cols) {
      if (cols) columns = cols
      return query
    },
    insert(value) { operation = "insert"; values = value; return query },
    upsert(value) { operation = "upsert"; values = value; return query },
    update(value) { operation = "update"; values = value; return query },
    delete() { operation = "delete"; return query },
    eq: (key, value) => where((row) => row[key] === value),
    neq: (key, value) => where((row) => row[key] !== value),
    in: (key, list) => where((row) => list.includes(row[key])),
    gte: (key, value) => where((row) => row[key] >= value),
    lte: (key, value) => where((row) => row[key] <= value),
    ilike: (key, value) => where((row) => String(row[key] || "").toLowerCase() === String(value).toLowerCase()),
    order() { return query },
    limit(n) { limit = n; return query },
    range(from, to) { slice = [from, to]; return query },
    single: async () => execute("single"),
    maybeSingle: async () => execute("maybeSingle"),
    then(resolve, reject) { return Promise.resolve(execute("many")).then(resolve, reject) },
  }
  return query
}

const db = { from }

// ---- in-memory platform ------------------------------------------------------

function createPlatform(platform, columns) {
  const venue = {
    id: `${platform}-venue`,
    name: "Le Temple Hanay",
    staff: columns,
    services: [{ id: `${platform}-thai`, name: "Massage Thaï 60 min", durationMinutes: 60, priceCents: 6000 }],
  }
  const bookings = new Map()
  let counter = 0
  const view = (b) => structuredClone({ ...b, ref: { id: b.externalId } })
  const adapter = {
    platform,
    async listVenues() { return [structuredClone(venue)] },
    async listBookings(_venue, fromDay, toDay) {
      return [...bookings.values()].filter((b) => b.start.slice(0, 10) >= fromDay && b.start.slice(0, 10) <= toDay).map(view)
    },
    async getBooking(ref) { return bookings.has(ref.id) ? view(bookings.get(ref.id)) : null },
    newBookingId: () => `${platform}-ours-${++counter}`,
    pendingRef: (input) => ({ id: input.externalId }),
    async createBooking(input) {
      bookings.set(input.externalId, {
        externalId: input.externalId, venueId: input.venueId, start: input.start,
        end: new Date(Date.parse(input.start) + input.durationMinutes * 60_000).toISOString(),
        status: "active", staff: [...input.staff].sort(), serviceIds: input.serviceId ? [input.serviceId] : [],
        serviceNames: [input.title], priceCents: input.priceCents,
        customer: input.customer ? { name: `${input.customer.firstName} ${input.customer.lastName}`.trim(), phone: input.customer.phone, email: input.customer.email } : null,
        isOurs: true, updatedAt: Date.now(),
      })
      return { id: input.externalId }
    },
    async updateBooking(ref, next) {
      Object.assign(bookings.get(ref.id), { start: next.start, end: next.end, staff: [...next.staff].sort(), updatedAt: Date.now() })
      return { id: ref.id }
    },
    async cancelBooking(ref) { Object.assign(bookings.get(ref.id), { status: "cancelled", updatedAt: Date.now() }) },
  }
  // What a client or the salon does directly on the platform.
  const outside = {
    book(start, column, customer) {
      const externalId = `${platform}-${++counter}`
      bookings.set(externalId, {
        externalId, venueId: venue.id, start, end: new Date(Date.parse(start) + 3_600_000).toISOString(), status: "active",
        staff: [column], serviceIds: [`${platform}-thai`], serviceNames: ["Massage Thaï 60 min"], priceCents: 6000,
        customer, isOurs: false, updatedAt: Date.now(),
      })
      return externalId
    },
    move(externalId, start, column) {
      const b = bookings.get(externalId)
      const duration = Date.parse(b.end) - Date.parse(b.start)
      Object.assign(b, { start, end: new Date(Date.parse(start) + duration).toISOString(), ...(column ? { staff: [column] } : {}), updatedAt: Date.now() })
    },
    cancel(externalId) { Object.assign(bookings.get(externalId), { status: "cancelled", updatedAt: Date.now() }) },
    retitle(externalId, serviceId, name) { Object.assign(bookings.get(externalId), { serviceIds: [serviceId], serviceNames: [name] }) },
    active: () => [...bookings.values()].filter((b) => b.status === "active"),
    find: (start) => [...bookings.values()].find((b) => Date.parse(b.start) === Date.parse(start)),
  }
  return { adapter, outside }
}

let planity
let treatwell

// ---- loader ------------------------------------------------------------------

const modules = new Map()
function load(relative) {
  const filename = path.join(root, relative)
  if (modules.has(filename)) return modules.get(filename).exports
  const mod = { exports: {} }
  modules.set(filename, mod)
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, {
    exports: mod.exports, process, console, URL, URLSearchParams, structuredClone, Buffer,
    require(name) {
      if (name === "@/lib/supabase/admin") return { createAdminClient: () => db }
      if (name === "@/lib/sync/planity") return { createPlanityAdapter: () => planity.adapter }
      if (name === "@/lib/sync/treatwell") return { createTreatwellAdapter: () => treatwell.adapter }
      if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`)
      return require(name)
    },
  }, { filename })
  return mod.exports
}

// ---- helpers -----------------------------------------------------------------

const engine = load("lib/sync/engine.ts")
// The engine runs in its own realm; a JSON copy lets deepEqual compare its output.
const runPlatformSync = async (options) => JSON.parse(JSON.stringify(await engine.runPlatformSync(options)))

async function sync(mode = "live") {
  const report = await runPlatformSync({ mode })
  for (const [platform, r] of Object.entries(report.platforms)) {
    assert.equal(r.status, "ok", `${platform}: ${r.message}`)
  }
  return report
}

function bookOnSite(start, staffId, client) {
  const clientId = id(sequence++)
  tables.clients.push({ id: clientId, ...client })
  const appointment = {
    id: id(sequence++), salon_id: SALON, client_id: clientId, staff_id: staffId, service_id: SERVICE, service_items: null,
    start_time: start, end_time: new Date(Date.parse(start) + 3_600_000).toISOString(), status: "confirmed", source: "site",
    created_at: now(), updated_at: now(),
  }
  tables.appointments.push(appointment)
  tables.appointment_assignments.push({ appointment_id: appointment.id, staff_id: staffId })
  return appointment
}

const local = (start) => tables.appointments.find((a) => Date.parse(a.start_time) === Date.parse(start))
const activeLocals = () => tables.appointments.filter((a) => a.status !== "cancelled")
const counts = (report, platform) => Object.fromEntries(Object.entries(report.platforms[platform].counts).filter(([, n]) => n))

function fresh() {
  resetDb()
  planity = createPlatform("planity", [{ id: "p-alice", name: "Alice" }, { id: "p-bea", name: "Bea" }, { id: "p-hammam", name: "Hammam" }])
  treatwell = createPlatform("treatwell", [{ id: "t-alice", name: "Alice (FEMME)" }, { id: "t-bea", name: "Béa" }])
}

// ---- scenarios ---------------------------------------------------------------

async function main() {
  fresh()
  let report = await sync()
  assert.deepEqual(report.platforms.planity.mapping.salons, [{ salon: "Le Temple Hanay", venue: "Le Temple Hanay" }])
  assert.equal(report.platforms.planity.mapping.staff.length, 2)
  assert.equal(report.platforms.treatwell.mapping.staff.length, 2, "accents and (FEMME) are ignored when pairing columns")
  assert.equal(report.platforms.planity.mapping.services, 1)
  console.log("PASS: salons, masseuses and services are paired by name on both platforms")

  const siteBooking = bookOnSite(at(0), ALICE, { first_name: "Camille", last_name: "Durand", phone: "06 12 34 56 78", email: "camille@example.test" })
  report = await sync("dry-run")
  assert.deepEqual(counts(report, "planity"), { push: 1 })
  assert.equal(planity.outside.active().length + treatwell.outside.active().length + tables.appointment_platform_links.length, 0)
  console.log("PASS: dry run reports the push and writes nothing anywhere")

  report = await sync()
  assert.deepEqual(counts(report, "planity"), { push: 1 })
  assert.deepEqual(counts(report, "treatwell"), { push: 1 })
  for (const platform of [planity, treatwell]) {
    const pushed = platform.outside.find(at(0))
    assert.equal(pushed.status, "active")
    assert.equal(pushed.isOurs, true)
    assert.equal(pushed.customer.name, "Camille Durand")
  }
  assert.deepEqual(planity.outside.find(at(0)).staff, ["p-alice"])
  assert.deepEqual(treatwell.outside.find(at(0)).staff, ["t-alice"])
  assert.deepEqual(planity.outside.find(at(0)).serviceIds, ["planity-thai"])
  console.log("PASS: site booking -> created on Planity and Treatwell with client, masseuse and service")

  report = await sync()
  assert.deepEqual(counts(report, "planity"), {})
  assert.deepEqual(counts(report, "treatwell"), {})
  console.log("PASS: second run is a no-op (the job's own writes never bounce back)")

  const fromPlanity = planity.outside.book(at(2), "p-bea", { name: "Lea Martin", phone: "+33698765432", email: null })
  report = await sync()
  assert.deepEqual(counts(report, "planity"), { import: 1 })
  assert.deepEqual(counts(report, "treatwell"), { push: 1 })
  const imported = local(at(2))
  assert.equal(imported.source, "planity")
  assert.equal(imported.staff_id, BEA)
  assert.equal(imported.service_id, SERVICE)
  assert.equal(tables.clients.find((c) => c.id === imported.client_id).phone, "0698765432")
  assert.deepEqual(treatwell.outside.find(at(2)).staff, ["t-bea"])
  assert.equal(planity.outside.active().filter((b) => Date.parse(b.start) === Date.parse(at(2))).length, 1, "never pushed back to Planity")
  console.log("PASS: Planity booking -> imported on the site and created on Treatwell in the same run")

  const fromTreatwell = treatwell.outside.book(at(4), "t-alice", { name: "Nora Petit", phone: "+33611223344", email: "nora@example.test" })
  report = await sync()
  assert.deepEqual(counts(report, "treatwell"), { import: 1 })
  assert.deepEqual(counts(report, "planity"), { push: 1 }, "the second pass carries it on to Planity")
  assert.equal(local(at(4)).source, "treatwell")
  assert.equal(local(at(4)).payment_method, "treatwell")
  assert.deepEqual(planity.outside.find(at(4)).staff, ["p-alice"])
  assert.equal(treatwell.outside.active().filter((b) => Date.parse(b.start) === Date.parse(at(4))).length, 1, "never pushed back to Treatwell")
  console.log("PASS: Treatwell booking -> imported on the site and created on Planity in the same run")

  report = await sync()
  assert.deepEqual([counts(report, "planity"), counts(report, "treatwell")], [{}, {}])
  assert.equal(activeLocals().length, 3)
  assert.equal(planity.outside.active().length, 3)
  assert.equal(treatwell.outside.active().length, 3)
  console.log("PASS: all three agendas hold the same 3 bookings and stay stable")

  planity.outside.move(fromPlanity, at(5), "p-alice")
  report = await sync()
  assert.deepEqual(counts(report, "planity"), { update_local: 1 })
  assert.deepEqual(counts(report, "treatwell"), { update_remote: 1 })
  assert.equal(Date.parse(local(at(5)).start_time), Date.parse(at(5)))
  assert.equal(local(at(5)).staff_id, ALICE)
  assert.deepEqual(treatwell.outside.find(at(5)).staff, ["t-alice"])
  console.log("PASS: moved on Planity (time and masseuse) -> moved on the site and on Treatwell")

  treatwell.outside.move(fromTreatwell, at(7))
  report = await sync()
  assert.deepEqual(counts(report, "treatwell"), { update_local: 1 })
  assert.deepEqual(counts(report, "planity"), { update_remote: 1 })
  assert.ok(planity.outside.find(at(7)))
  console.log("PASS: moved on Treatwell -> moved on the site and on Planity")

  tables.appointments.find((a) => a.id === siteBooking.id).status = "cancelled"
  report = await sync()
  assert.deepEqual(counts(report, "planity"), { cancel_remote: 1 })
  assert.deepEqual(counts(report, "treatwell"), { cancel_remote: 1 })
  assert.equal(planity.outside.find(at(0)).status, "cancelled")
  assert.equal(treatwell.outside.find(at(0)).status, "cancelled")
  console.log("PASS: cancelled on the site -> cancelled on Planity and Treatwell")

  treatwell.outside.cancel(fromTreatwell)
  report = await sync()
  assert.deepEqual(counts(report, "treatwell"), { cancel_local: 1 })
  assert.deepEqual(counts(report, "planity"), { cancel_remote: 1 })
  assert.equal(local(at(7)).status, "cancelled")
  assert.equal(planity.outside.find(at(7)).status, "cancelled")
  console.log("PASS: cancelled on Treatwell -> cancelled on the site and on Planity")

  planity.outside.cancel(planity.outside.find(at(5)).externalId)
  report = await sync()
  assert.deepEqual(counts(report, "planity"), { cancel_local: 1 })
  assert.deepEqual(counts(report, "treatwell"), { cancel_remote: 1 })
  assert.equal(treatwell.outside.find(at(5)).status, "cancelled")
  console.log("PASS: cancelled on Planity -> cancelled on the site and on Treatwell")

  // Double booking: Treatwell sells a slot the site already gave away.
  fresh()
  bookOnSite(at(0, 2), BEA, { first_name: "Ines", last_name: "Roux", phone: "0700000001", email: null })
  await sync()
  treatwell.outside.book(at(0.5, 2), "t-bea", { name: "Zoe Blanc", phone: "+33700000002", email: null })
  report = await sync()
  assert.equal(report.platforms.treatwell.counts.import, 0)
  assert.match(report.platforms.treatwell.warnings.join("\n"), /conflit/)
  assert.equal(activeLocals().length, 1)
  console.log("PASS: overlapping Treatwell booking is reported as a conflict, never imported over the site booking")

  // Same booking typed by hand on the site and on Planity: paired, not duplicated.
  fresh()
  bookOnSite(at(3, 3), ALICE, { first_name: "Sarah", last_name: "Klein", phone: "06 55 44 33 22", email: null })
  planity.outside.book(at(3, 3), "p-alice", { name: "Sarah Klein", phone: "+33655443322", email: null })
  report = await sync()
  assert.deepEqual(counts(report, "planity"), { match: 1 })
  assert.deepEqual(counts(report, "treatwell"), { push: 1 })
  assert.equal(activeLocals().length, 1)
  assert.equal(planity.outside.active().length, 1)
  console.log("PASS: a booking already on both sides is linked, not duplicated")

  // A platform that is down must not stop the other one.
  fresh()
  bookOnSite(at(1, 4), BEA, { first_name: "Ana", last_name: "Lopez", phone: "0612121212", email: null })
  const { PlatformUnavailableError } = load("lib/sync/types.ts")
  treatwell.adapter.listVenues = async () => { throw new PlatformUnavailableError("treatwell", "Session Treatwell expirée") }
  report = await runPlatformSync({ mode: "live" })
  assert.equal(report.platforms.treatwell.status, "unavailable")
  assert.equal(report.platforms.planity.status, "ok")
  assert.deepEqual(counts(report, "planity"), { push: 1 })
  console.log("PASS: Treatwell unavailable -> reported, Planity still synced")

  // A masseuse with no Treatwell column: one grouped warning, nothing sent, Planity unaffected.
  fresh()
  treatwell = createPlatform("treatwell", [{ id: "t-alice", name: "Alice" }])
  bookOnSite(at(1, 5), BEA, { first_name: "Eva", last_name: "Morel", phone: "0611111111", email: null })
  bookOnSite(at(3, 5), BEA, { first_name: "Jade", last_name: "Simon", phone: "0622222222", email: null })
  report = await sync()
  assert.deepEqual(counts(report, "planity"), { push: 2 })
  assert.deepEqual(counts(report, "treatwell"), {})
  assert.deepEqual(report.platforms.treatwell.warnings, [
    "Le Temple Hanay · Bea — 2 rendez-vous non envoyés : aucune colonne Treatwell associée (même prénom dans Treatwell, ou ligne dans platform_mappings)",
  ])
  console.log("PASS: masseuse without a Treatwell column -> one grouped warning, Planity still synced")

  // A Treatwell walk-in whose prestation has no site equivalent: no site service, no client card,
  // so Planity gets the import note as the slot's title instead of a bare "Prestation".
  fresh()
  const walkIn = treatwell.outside.book(at(2, 6), "t-alice", { name: "Lina Walk", phone: null, email: null })
  treatwell.outside.retitle(walkIn, "treatwell-signature", "Soin signature 60 min")
  report = await sync()
  assert.deepEqual(counts(report, "treatwell"), { import: 1 })
  assert.deepEqual(counts(report, "planity"), { push: 1 })
  assert.equal(local(at(2, 6)).service_id, null)
  assert.equal(local(at(2, 6)).client_id, null)
  assert.equal(planity.outside.find(at(2, 6)).serviceNames[0], "Réservé sur Treatwell : Soin signature 60 min (60.00 €) — client : Lina Walk")
  assert.equal(planity.outside.find(at(2, 6)).customer, null)
  console.log("PASS: a booking with no site prestation or client card reaches the other platform titled with its origin, prestation and client")

  // Toui / Moui: two masseuses whose names differ by one letter. The exact
  // name must win over the one-typo match instead of leaving both unpaired.
  fresh()
  tables.staff.push(
    { id: id(5), salon_id: SALON, first_name: "Madame", last_name: "Toui", is_active: true },
    { id: id(6), salon_id: SALON, first_name: "Madame", last_name: "Moui", is_active: true }
  )
  planity = createPlatform("planity", [{ id: "p-toui", name: "Toui" }, { id: "p-moui", name: "Moui" }])
  treatwell = createPlatform("treatwell", [{ id: "t-toui", name: "Toui" }, { id: "t-moui", name: "Moui" }])
  report = await sync()
  for (const platform of ["planity", "treatwell"]) {
    const pairs = Object.fromEntries(report.platforms[platform].mapping.staff.map((s) => [s.staff, s.column]))
    assert.equal(pairs.Toui, "Toui", `${platform}: Toui`)
    assert.equal(pairs.Moui, "Moui", `${platform}: Moui`)
  }
  console.log("PASS: Toui and Moui each pair with their exact column despite being one letter apart")

  // A push that died between the remote write and its confirmation: the
  // pending link's provisional ref finds the booking and adopts it.
  fresh()
  const ghost = bookOnSite(at(2, 7), ALICE, { first_name: "Mia", last_name: "Bernard", phone: "0633333333", email: null })
  await planity.adapter.createBooking({
    externalId: "planity-ghost", venueId: "planity-venue", start: ghost.start_time, durationMinutes: 60,
    staff: ["p-alice"], serviceId: "planity-thai", title: "Massage Thai 60 min", priceCents: 6000, customer: null,
  })
  tables.appointment_platform_links.push({
    id: id(sequence++), appointment_id: ghost.id, platform: "planity", external_id: "planity-ghost",
    external_ref: { id: "planity-ghost" }, snapshot: null, origin: "pushed",
    synced_at: now(), created_at: new Date(Date.now() - 3_600_000).toISOString(),
  })
  report = await sync()
  assert.equal(planity.outside.active().filter((b) => Date.parse(b.start) === Date.parse(ghost.start_time)).length, 1, "adopted, not duplicated")
  assert.ok(tables.appointment_platform_links.find((l) => l.external_id === "planity-ghost").snapshot, "pending link confirmed")
  console.log("PASS: a push interrupted after the remote write is adopted, not duplicated")

  // The same situation seen by a one-day run for ANOTHER day (immediate sync
  // after a booking change): it cannot see that booking, so it must leave the
  // link alone. The next full run frees it and the booking is pushed again.
  fresh()
  const lost = bookOnSite(at(2, 9), BEA, { first_name: "Lou", last_name: "Faure", phone: "0644444444", email: null })
  tables.appointment_platform_links.push({
    id: id(sequence++), appointment_id: lost.id, platform: "planity", external_id: "planity-lost",
    external_ref: {}, snapshot: null, origin: "pushed",
    synced_at: now(), created_at: new Date(Date.now() - 3_600_000).toISOString(),
  })
  const otherDay = at(0, 2).slice(0, 10)
  await runPlatformSync({ mode: "live", window: { from: otherDay, to: otherDay } })
  assert.ok(tables.appointment_platform_links.find((l) => l.external_id === "planity-lost"), "a narrow run leaves the link it cannot see")
  report = await sync()
  assert.ok(!tables.appointment_platform_links.find((l) => l.external_id === "planity-lost"), "the full run frees the unconfirmed link")
  assert.equal(planity.outside.active().filter((b) => Date.parse(b.start) === Date.parse(lost.start_time)).length, 1, "and pushes the booking once")
  console.log("PASS: an unverifiable pending link survives narrow runs and is retried by the full one")

  // An orphan the sync created whose link row disappeared: relinked to its
  // local twin instead of warning and letting step 3 duplicate it.
  fresh()
  bookOnSite(at(4, 8), ALICE, { first_name: "Emma", last_name: "Noel", phone: "0655555555", email: null })
  await sync()
  tables.appointment_platform_links = tables.appointment_platform_links.filter((l) => l.platform !== "planity")
  report = await sync()
  assert.deepEqual(counts(report, "planity"), { match: 1 })
  assert.equal(planity.outside.active().length, 1, "no duplicate pushed")
  assert.deepEqual(report.platforms.planity.warnings, [])
  console.log("PASS: an orphan created by the sync is relinked to its local twin, not duplicated")

  // A true duplicate from the lost-link era: an identical linked copy exists,
  // so the orphan is cancelled on the platform automatically.
  fresh()
  const dup = bookOnSite(at(6, 8), BEA, { first_name: "Ava", last_name: "Henry", phone: "0666666666", email: null })
  await sync()
  await planity.adapter.createBooking({
    externalId: "planity-dup", venueId: "planity-venue", start: dup.start_time, durationMinutes: 60,
    staff: ["p-bea"], serviceId: "planity-thai", title: "Massage Thai 60 min", priceCents: 6000,
    customer: { firstName: "Ava", lastName: "Henry", phone: "0666666666", email: null },
  })
  report = await sync()
  assert.deepEqual(counts(report, "planity"), { cancel_remote: 1 })
  assert.equal(planity.outside.active().filter((b) => Date.parse(b.start) === Date.parse(dup.start_time)).length, 1, "one copy left")
  assert.equal(planity.outside.active().length + 0, 1)
  console.log("PASS: a duplicate the engine once created is cancelled automatically")

  // More links than PostgREST returns in one response (what broke production
  // on 11/11): the engine must still see every link, or linked bookings read
  // as unlinked and are re-matched / re-pushed on every run.
  fresh()
  const past = new Date(Date.now() - 30 * DAY).toISOString()
  for (let i = 0; i < 1150; i++) {
    tables.appointment_platform_links.push({
      id: id(sequence++), appointment_id: id(sequence++), platform: "planity", external_id: `planity-old-${i}`,
      external_ref: {}, origin: "pushed", synced_at: past, created_at: past,
      snapshot: { start: past, end: past, status: "cancelled", staff: [] },
    })
  }
  bookOnSite(at(3, 10), ALICE, { first_name: "Noa", last_name: "Vidal", phone: "0677777777", email: null })
  await sync()
  report = await sync()
  assert.deepEqual(counts(report, "planity"), {}, "nothing re-pushed or re-matched")
  assert.deepEqual(report.platforms.planity.warnings, [])
  assert.equal(planity.outside.active().length, 1)
  console.log("PASS: with more links than one database page, every link is still honoured")

  // Run lock.
  tables.platform_sync_runs.push({ id: id(9999), mode: "live", status: "running", started_at: now() })
  assert.ok("skipped" in (await runPlatformSync({ mode: "live" })))
  console.log("PASS: a second concurrent run is skipped")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
