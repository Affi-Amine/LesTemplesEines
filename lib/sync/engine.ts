import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

import { createAdminClient } from "@/lib/supabase/admin"
import { resolveMapping, type PlatformMapping } from "@/lib/sync/mappings"
import { phoneVariants, splitName } from "@/lib/sync/matching"
import { createPlanityAdapter } from "@/lib/sync/planity"
import { createTreatwellAdapter } from "@/lib/sync/treatwell"
import {
  PLATFORM_LABELS,
  PlatformUnavailableError,
  type BookingState,
  type ExternalBooking,
  type Platform,
  type PlatformAdapter,
  type PushBookingInput,
} from "@/lib/sync/types"

// Mirrors bookings between the site and each platform. Per platform, a run:
//   1. reads the platform's bookings in the window and the local ones;
//   2. for every linked pair, compares both sides with the snapshot stored at
//      the last sync and applies whichever side changed to the other
//      (cancellation wins when both changed);
//   3. imports platform bookings it has never seen, first trying to pair them
//      with an identical local booking entered by hand;
//   4. pushes local bookings the platform has never seen.
// A booking made on Treatwell therefore reaches Planity in two hops: it is
// imported here, then pushed to Planity like any local booking.

type SupabaseClient = ReturnType<typeof createAdminClient>

const TIMEZONE = "Europe/Paris"
const DEFAULT_WINDOW_DAYS = 60
/** Imports + pushes per platform per run; a large backlog catches up over a few runs. */
const MAX_CREATES_PER_RUN = 120
const LOCK_MINUTES = 10
/** A push whose remote write never confirmed is retried after this delay. */
const PENDING_PUSH_MINUTES = 15
const MAX_REPORTED_ACTIONS = 300
const ACTIVE_LOCAL = ["confirmed", "pending", "in_progress"]

export type SyncMode = "dry-run" | "live"
type ActionKind = "import" | "match" | "push" | "update_local" | "update_remote" | "cancel_local" | "cancel_remote"

export interface PlatformReport {
  status: "ok" | "unavailable" | "error"
  message?: string
  mapping?: PlatformMapping["summary"]
  fetched: number
  counts: Record<ActionKind, number>
  actions: { kind: ActionKind; detail: string }[]
  warnings: string[]
}

export interface SyncReport {
  mode: SyncMode
  window: { from: string; to: string }
  platforms: Partial<Record<Platform, PlatformReport>>
  durationMs: number
}

interface LinkRow {
  id: string
  appointment_id: string
  external_id: string
  external_ref: Record<string, unknown>
  snapshot: BookingState | null
  created_at: string
}

interface LocalAppointment {
  id: string
  salon_id: string
  client_id: string | null
  staff_id: string | null
  service_id: string | null
  service_items: { id: string; name: string; price_cents: number }[] | null
  start_time: string
  end_time: string
  status: string
  source: string
  internal_notes: string | null
  updated_at: string
  client: { first_name: string | null; last_name: string | null; phone: string | null; email: string | null } | null
  service: { name: string; price_cents: number } | null
  staffIds: string[]
}

const LOCAL_SELECT = `
  id, salon_id, client_id, staff_id, service_id, service_items, start_time, end_time, status, source, internal_notes, updated_at,
  client:clients(first_name, last_name, phone, email),
  service:services(name, price_cents),
  assignments:appointment_assignments(staff_id)
`

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase embeds come back untyped */
function toLocal(row: any): LocalAppointment {
  const one = (value: any) => (Array.isArray(value) ? value[0] ?? null : value ?? null)
  const staffIds = [row.staff_id, ...(row.assignments || []).map((a: any) => a.staff_id)].filter(Boolean)
  return { ...row, client: one(row.client), service: one(row.service), staffIds: [...new Set<string>(staffIds)] }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const iso = (value: string) => new Date(value).toISOString()

function sameState(a: BookingState, b: BookingState) {
  return Date.parse(a.start) === Date.parse(b.start) &&
    Date.parse(a.end) === Date.parse(b.end) &&
    a.status === b.status &&
    a.staff.join() === b.staff.join()
}

function stateOf(booking: BookingState): BookingState {
  return { start: iso(booking.start), end: iso(booking.end), status: booking.status, staff: [...booking.staff].sort() }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function runPlatformSync(options: {
  mode: SyncMode
  platforms?: Platform[]
  /** Paris days to sync instead of today + PLATFORM_SYNC_DAYS, e.g. to test on an empty future day. */
  window?: { from: string; to: string }
  /** Who started the run from the back office; the cron leaves it empty. */
  triggeredBy?: string
}): Promise<SyncReport | { skipped: string }> {
  const supabase = createAdminClient()
  const startedAt = Date.now()

  const { data: running, error: lockError } = await supabase
    .from("platform_sync_runs")
    .select("id")
    .eq("status", "running")
    .gte("started_at", new Date(startedAt - LOCK_MINUTES * 60_000).toISOString())
    .limit(1)
  if (lockError) throw new Error(`${lockError.message} (migration 2026-10-30_platform_sync.sql appliquée ?)`)
  if (running?.length) return { skipped: "Une synchronisation est déjà en cours." }

  const { data: run, error: runError } = await supabase
    .from("platform_sync_runs")
    .insert({ mode: options.mode, ...(options.triggeredBy ? { triggered_by: options.triggeredBy } : {}) })
    .select("id, started_at")
    .single()
  if (runError || !run) throw new Error(runError?.message || "Impossible d'enregistrer la synchronisation")

  // The check above and the insert are not atomic: the cron and an event
  // trigger can start together and both pass it, and two engines on the same
  // bookings duplicate links and pushes. Re-check now that our row is visible;
  // of two runs that see each other, the younger one (id as tiebreak) withdraws.
  const { data: rivals } = await supabase
    .from("platform_sync_runs")
    .select("id, started_at")
    .eq("status", "running")
    .neq("id", run.id)
    .gte("started_at", new Date(startedAt - LOCK_MINUTES * 60_000).toISOString())
  if ((rivals || []).some((r) => r.started_at < run.started_at || (r.started_at === run.started_at && r.id < run.id))) {
    await supabase.from("platform_sync_runs").delete().eq("id", run.id)
    return { skipped: "Une synchronisation est déjà en cours." }
  }

  const days = Number(process.env.PLATFORM_SYNC_DAYS) || DEFAULT_WINDOW_DAYS
  const report: SyncReport = {
    mode: options.mode,
    window: options.window || {
      from: formatInTimeZone(new Date(startedAt), TIMEZONE, "yyyy-MM-dd"),
      to: formatInTimeZone(new Date(startedAt + days * 86_400_000), TIMEZONE, "yyyy-MM-dd"),
    },
    platforms: {},
    durationMs: 0,
  }

  try {
    const order = options.platforms || (["planity", "treatwell"] as Platform[])
    const adapters = new Map(order.map((platform) => [platform, platform === "planity" ? createPlanityAdapter(supabase) : createTreatwellAdapter(supabase)]))
    for (const platform of order) {
      report.platforms[platform] = await syncPlatform(supabase, adapters.get(platform)!, options.mode, report.window)
    }
    // A change pulled into the site from a later platform (a Treatwell booking
    // imported, moved or cancelled) reaches the earlier ones in this same run
    // instead of waiting for the next one. Dry runs write nothing, so a second
    // pass would only repeat the first.
    if (options.mode === "live") {
      const lastPulled = order.findLastIndex((platform) => {
        const counts = report.platforms[platform]?.counts
        return Boolean(counts && (counts.import || counts.update_local || counts.cancel_local))
      })
      for (const platform of order.slice(0, Math.max(lastPulled, 0))) {
        if (report.platforms[platform]?.status !== "ok") continue
        const second = await syncPlatform(supabase, adapters.get(platform)!, options.mode, report.window)
        report.platforms[platform] = mergeReports(report.platforms[platform]!, second)
      }
    }
    report.durationMs = Date.now() - startedAt
    await supabase.from("platform_sync_runs").update({ status: "done", report, finished_at: new Date().toISOString() }).eq("id", run.id)
    return report
  } catch (error) {
    await supabase.from("platform_sync_runs").update({ status: "failed", error: errorMessage(error), finished_at: new Date().toISOString() }).eq("id", run.id)
    throw error
  }
}

function mergeReports(first: PlatformReport, second: PlatformReport): PlatformReport {
  const counts = { ...first.counts }
  for (const kind of Object.keys(counts) as ActionKind[]) counts[kind] += second.counts[kind]
  return {
    ...first,
    status: second.status,
    message: second.message,
    fetched: Math.max(first.fetched, second.fetched),
    counts,
    actions: [...first.actions, ...second.actions].slice(0, MAX_REPORTED_ACTIONS),
    // Both passes see the same unresolved conflicts.
    warnings: [...new Set([...first.warnings, ...second.warnings])],
  }
}

async function syncPlatform(
  supabase: SupabaseClient,
  adapter: PlatformAdapter,
  mode: SyncMode,
  window: { from: string; to: string }
): Promise<PlatformReport> {
  const report: PlatformReport = {
    status: "ok",
    fetched: 0,
    counts: { import: 0, match: 0, push: 0, update_local: 0, update_remote: 0, cancel_local: 0, cancel_remote: 0 },
    actions: [],
    warnings: [],
  }
  try {
    await reconcile(supabase, adapter, mode, window, report)
  } catch (error) {
    report.status = error instanceof PlatformUnavailableError ? "unavailable" : "error"
    report.message = errorMessage(error)
  }
  return report
}

async function reconcile(
  supabase: SupabaseClient,
  adapter: PlatformAdapter,
  mode: SyncMode,
  window: { from: string; to: string },
  report: PlatformReport
) {
  const live = mode === "live"
  const platform = adapter.platform
  const label = PLATFORM_LABELS[platform]
  const now = Date.now()
  const windowStart = fromZonedTime(`${window.from}T00:00:00`, TIMEZONE).toISOString()
  const windowEnd = fromZonedTime(`${window.to}T23:59:59`, TIMEZONE).toISOString()

  const venues = await adapter.listVenues()
  const mapping = await resolveMapping(supabase, platform, venues)
  report.mapping = mapping.summary

  const external = new Map<string, ExternalBooking>()
  for (const venue of mapping.venueBySalon.values()) {
    for (const booking of await adapter.listBookings(venue, window.from, window.to)) external.set(booking.externalId, booking)
  }
  report.fetched = external.size

  const { data: linkRows, error: linkError } = await supabase
    .from("appointment_platform_links")
    .select("id, appointment_id, external_id, external_ref, snapshot, created_at")
    .eq("platform", platform)
  if (linkError) throw new Error(linkError.message)
  const links = (linkRows || []) as LinkRow[]
  const linkedExternal = new Set(links.map((l) => l.external_id))
  const linkedLocal = new Set(links.map((l) => l.appointment_id))

  const locals = new Map<string, LocalAppointment>()
  const salonIds = [...mapping.venueBySalon.keys()]
  if (salonIds.length) {
    const { data, error } = await supabase
      .from("appointments")
      .select(LOCAL_SELECT)
      .in("salon_id", salonIds)
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd)
      .neq("status", "blocked")
    if (error) throw new Error(error.message)
    for (const row of (data || []) as unknown[]) {
      const local = toLocal(row)
      locals.set(local.id, local)
    }
  }
  // Linked bookings moved outside the window on our side still need comparing.
  const outside = links.filter((l) => !locals.has(l.appointment_id) && (external.has(l.external_id) || (l.snapshot && l.snapshot.start >= windowStart && l.snapshot.start <= windowEnd)))
  for (let i = 0; i < outside.length; i += 100) {
    const { data, error } = await supabase.from("appointments").select(LOCAL_SELECT).in("id", outside.slice(i, i + 100).map((l) => l.appointment_id))
    if (error) throw new Error(error.message)
    for (const row of (data || []) as unknown[]) {
      const local = toLocal(row)
      locals.set(local.id, local)
    }
  }

  // ---- helpers -------------------------------------------------------------

  const record = (kind: ActionKind, detail: string) => {
    report.counts[kind] += 1
    if (report.actions.length < MAX_REPORTED_ACTIONS) report.actions.push({ kind, detail })
  }
  /** Returned by a write to say a concurrent run already did the work: not an action, not a warning. */
  const SKIP = Symbol("skip")
  /** Runs `write` in live mode only; failures become warnings so one bad booking never stops the run. */
  const attempt = async (kind: ActionKind, detail: string, write: () => Promise<unknown>) => {
    try {
      if (live && (await write()) === SKIP) return false
      record(kind, detail)
      return true
    } catch (error) {
      const message = errorMessage(error)
      report.warnings.push(`${detail} — ${/23P01|plus disponible|vient d.être réservé/.test(message) ? `conflit : la masseuse est déjà prise sur ce créneau (double réservation à régler à la main)` : message}`)
      return false
    }
  }
  const updateLink = async (id: string, values: Record<string, unknown>) => {
    if (!live) return
    const { error } = await supabase.from("appointment_platform_links").update({ ...values, synced_at: new Date().toISOString() }).eq("id", id)
    if (error) throw new Error(error.message)
  }
  const describe = (start: string, salonId: string | undefined, staff: string[], service: string, who: string | null) => {
    const names = staff.map((id) => mapping.names.columns.get(id) || mapping.names.staff.get(id) || "?").join(" + ")
    const initials = who ? who.split(/\s+/).map((w) => w[0]?.toUpperCase()).join("") : "sans client"
    return `${formatInTimeZone(new Date(start), TIMEZONE, "dd/MM HH:mm")} · ${mapping.names.salons.get(salonId || "") || "?"} · ${names || "?"} · ${service} · ${initials}`
  }
  // States are compared on mapped columns only: a booking may also occupy a
  // column the site has no staff for (e.g. a hammam cabin), which local data
  // can't express and which must not read as a change.
  const mappedOnly = (staff: string[]) => staff.filter((id) => mapping.externalToStaff.has(id))
  const remoteState = (booking: ExternalBooking): BookingState => ({ ...stateOf(booking), staff: mappedOnly(stateOf(booking).staff) })
  const localState = (local: LocalAppointment, fallbackStaff: string[]): BookingState => {
    const staff = local.staffIds.map((id) => mapping.staffToExternal.get(id)).filter((id): id is string => Boolean(id)).sort()
    return { start: iso(local.start_time), end: iso(local.end_time), status: local.status === "cancelled" ? "cancelled" : "active", staff: staff.length ? staff : fallbackStaff }
  }
  const localServiceName = (local: LocalAppointment) =>
    local.service_items?.length ? local.service_items.map((s) => s.name).join(" + ") : local.service?.name || "Prestation"

  async function setAssignments(appointmentId: string, staffIds: string[]) {
    const { error: deleteError } = await supabase.from("appointment_assignments").delete().eq("appointment_id", appointmentId)
    if (deleteError) throw new Error(deleteError.message)
    const { error } = await supabase.from("appointment_assignments").insert(staffIds.map((staff_id) => ({ appointment_id: appointmentId, staff_id })))
    if (error) throw new Error(error.message)
  }

  async function applyToLocal(local: LocalAppointment, next: BookingState) {
    const staffIds = next.staff.map((id) => mapping.externalToStaff.get(id)).filter((id): id is string => Boolean(id))
    const staffChanged = staffIds.length > 0 && staffIds.sort().join() !== [...local.staffIds].sort().join()
    const { error } = await supabase
      .from("appointments")
      .update({
        start_time: next.start,
        end_time: next.end,
        ...(local.status === "cancelled" ? { status: "confirmed" } : {}),
        ...(staffChanged ? { staff_id: staffIds[0] } : {}),
      })
      .eq("id", local.id)
    if (error) throw new Error(error.message)
    if (staffChanged) await setAssignments(local.id, staffIds)
  }

  /** Null when the platform customer has no phone: clients.phone is required and unique. */
  async function findOrCreateClient(customer: NonNullable<ExternalBooking["customer"]>) {
    const phones = phoneVariants(customer.phone)
    for (const phone of phones) {
      const { data } = await supabase.from("clients").select("id").eq("phone", phone).limit(1)
      if (data?.[0]) return data[0].id as string
    }
    if (customer.email) {
      const { data } = await supabase.from("clients").select("id").ilike("email", customer.email).limit(1)
      if (data?.[0]) return data[0].id as string
    }
    if (!phones.length) return null
    const { firstName, lastName } = splitName(customer.name)
    const { data, error } = await supabase
      .from("clients")
      // The site stores French numbers in national format ("06…").
      .insert({ first_name: firstName, last_name: lastName, phone: phones.find((p) => p.startsWith("0")) || phones[0], email: customer.email })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message || "Client non créé")
    return data.id as string
  }

  // ---- 1. linked pairs -----------------------------------------------------

  for (const link of links) {
    const local = locals.get(link.appointment_id)
    let remote: ExternalBooking | null = external.get(link.external_id) || null

    if (!link.snapshot) {
      // Push reserved but never confirmed. The remote write may have landed
      // anyway (crash or timeout after it), so ask the platform through the
      // provisional ref before deciding: adopt the booking if it exists, and
      // free the link for a retry only once its absence is confirmed — a blind
      // delete here re-pushed bookings that did exist and created duplicates.
      const hasRef = Boolean(link.external_ref && Object.keys(link.external_ref).length)
      if (!remote && hasRef) {
        try {
          remote = await adapter.getBooking(link.external_ref)
        } catch {
          continue // can't verify right now: leave the link to a later run
        }
      }
      if (remote) await updateLink(link.id, { snapshot: remoteState(remote), external_ref: remote.ref })
      else if ((hasRef || locals.has(link.appointment_id)) && Date.parse(link.created_at) < now - PENDING_PUSH_MINUTES * 60_000 && live) {
        // Links from before provisional refs existed can only be checked
        // against the listing, so those are freed only when this run's window
        // covered their booking and the listing would have shown it.
        await supabase.from("appointment_platform_links").delete().eq("id", link.id)
        linkedLocal.delete(link.appointment_id)
      }
      continue
    }
    if (!local) continue
    if (!remote) {
      if (Date.parse(link.snapshot.end) < now) continue
      remote = await adapter.getBooking(link.external_ref)
    }

    const snapshot = link.snapshot
    const mine = localState(local, snapshot.staff)
    const theirs: BookingState = remote ? remoteState(remote) : { ...snapshot, status: "cancelled" }
    const ref = remote?.ref || link.external_ref
    const mineChanged = !sameState(mine, snapshot)
    const theirsChanged = !sameState(theirs, snapshot)

    if (!mineChanged && !theirsChanged) {
      if (remote && JSON.stringify(remote.ref) !== JSON.stringify(link.external_ref)) await updateLink(link.id, { external_ref: remote.ref })
      continue
    }
    if (sameState(mine, theirs)) {
      await updateLink(link.id, { snapshot: mine, external_ref: ref })
      continue
    }

    let pull: boolean
    if (mineChanged !== theirsChanged) pull = theirsChanged
    else if (mine.status === "cancelled" || theirs.status === "cancelled") pull = theirs.status === "cancelled"
    else pull = (remote?.updatedAt || 0) >= Date.parse(local.updated_at)

    const detail = describe(pull ? theirs.start : mine.start, local.salon_id, pull ? theirs.staff : mine.staff, localServiceName(local), local.client ? `${local.client.first_name} ${local.client.last_name}` : null)

    if (pull) {
      const ok = theirs.status === "cancelled"
        ? await attempt("cancel_local", `${detail} (annulé sur ${label})`, async () => {
            const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", local.id)
            if (error) throw new Error(error.message)
          })
        : await attempt("update_local", `${detail} (modifié sur ${label})`, () => applyToLocal(local, theirs))
      if (ok) await updateLink(link.id, { snapshot: theirs, external_ref: ref })
    } else if (mine.status === "cancelled") {
      if (await attempt("cancel_remote", detail, () => adapter.cancelBooking(ref))) await updateLink(link.id, { snapshot: mine })
    } else if (theirs.status === "cancelled") {
      // Re-activated here after being cancelled there: drop the link so step 3 books it again.
      if (live) await supabase.from("appointment_platform_links").delete().eq("id", link.id)
      linkedLocal.delete(local.id)
    } else {
      let nextRef = ref
      const keptColumns = (remote?.staff || []).filter((id) => !mapping.externalToStaff.has(id))
      const target = { ...mine, staff: [...mine.staff, ...keptColumns].sort() }
      if (await attempt("update_remote", detail, async () => { nextRef = await adapter.updateBooking(ref, target) })) {
        await updateLink(link.id, { snapshot: mine, external_ref: nextRef })
      }
    }
  }

  // ---- 2. bookings only the platform knows ---------------------------------

  let creates = 0
  const unlinkedLocals = () => [...locals.values()].filter((l) => !linkedLocal.has(l.id))

  // The same booking on both sides? Same salon and start, then the same client
  // when both sides have a phone, otherwise the same masseuse and the same
  // end. Staff overlap alone would pair two different clients booked with the
  // same masseuse (a double booking, not a twin).
  const twinOf = (booking: ExternalBooking, salonId: string) => {
    const phones = new Set(phoneVariants(booking.customer?.phone))
    return unlinkedLocals().find((l) => {
      if (l.salon_id !== salonId || l.status === "cancelled" || Date.parse(l.start_time) !== Date.parse(booking.start)) return false
      const localPhones = phoneVariants(l.client?.phone)
      if (phones.size && localPhones.length) return localPhones.some((p) => phones.has(p))
      return Date.parse(l.end_time) === Date.parse(booking.end) && l.staffIds.some((id) => booking.staff.includes(mapping.staffToExternal.get(id) || ""))
    })
  }
  const relink = async (booking: ExternalBooking, twin: LocalAppointment, detail: string) => {
    record("match", detail)
    linkedLocal.add(twin.id)
    linkedExternal.add(booking.externalId)
    if (live) {
      const { error } = await supabase.from("appointment_platform_links").insert({
        appointment_id: twin.id, platform, external_id: booking.externalId, external_ref: booking.ref, origin: "matched",
        // Snapshot from our side: if the two differ, the next run carries the platform's version over.
        snapshot: localState(twin, mappedOnly(booking.staff)),
      })
      // 23505: a concurrent run linked it first, which is just as good.
      if (error && (error as { code?: string }).code !== "23505") report.warnings.push(`${detail} — ${error.message}`)
    }
  }

  for (const booking of external.values()) {
    if (linkedExternal.has(booking.externalId) || booking.status === "cancelled" || Date.parse(booking.end) < now) continue
    const salonId = mapping.salonByVenue.get(booking.venueId)
    if (!salonId) continue
    const detail = describe(booking.start, salonId, booking.staff, booking.serviceNames.join(" + "), booking.customer?.name || null)
    if (booking.isOurs) {
      // Our own creation whose link row is gone (lost run, deleted link): take
      // it back instead of leaving an orphan that step 3 would then duplicate.
      const twin = twinOf(booking, salonId)
      if (twin) {
        await relink(booking, twin, `${detail} (recollé au rendez-vous du site)`)
        continue
      }
      // No local twin, but an identical copy that IS linked: this one is a
      // duplicate a lost link made the engine create. Remove it.
      const double = [...external.values()].find((other) => other.externalId !== booking.externalId &&
        other.isOurs && other.status === "active" && linkedExternal.has(other.externalId) && other.venueId === booking.venueId &&
        Date.parse(other.start) === Date.parse(booking.start) && Date.parse(other.end) === Date.parse(booking.end) &&
        remoteState(other).staff.join() === remoteState(booking).staff.join())
      if (double) {
        await attempt("cancel_remote", `${detail} (doublon créé par la synchro : annulé)`, () => adapter.cancelBooking(booking.ref))
        continue
      }
      report.warnings.push(`${detail} — créé par la synchro mais plus relié à un rendez-vous du site ; vérifiez qu'il n'est pas en double`)
      continue
    }

    const twin = twinOf(booking, salonId)
    if (twin) {
      await relink(booking, twin, detail)
      continue
    }

    const staffIds = booking.staff.map((id) => mapping.externalToStaff.get(id)).filter((id): id is string => Boolean(id))
    if (!staffIds.length) {
      report.warnings.push(`${detail} — colonne ${label} non associée à une masseuse du site : non importé`)
      continue
    }
    // The database guard would reject it anyway; checking here keeps dry runs honest.
    const clash = [...locals.values()].find((l) => ACTIVE_LOCAL.includes(l.status) &&
      Date.parse(l.start_time) < Date.parse(booking.end) && Date.parse(l.end_time) > Date.parse(booking.start) &&
      l.staffIds.some((id) => staffIds.includes(id)))
    if (clash) {
      report.warnings.push(`${detail} — conflit : déjà un rendez-vous sur le site à ${formatInTimeZone(new Date(clash.start_time), TIMEZONE, "HH:mm")} pour cette masseuse (double réservation à régler à la main)`)
      continue
    }
    if (creates >= MAX_CREATES_PER_RUN) continue
    creates += 1

    await attempt("import", detail, async () => {
      const clientId = booking.customer ? await findOrCreateClient(booking.customer) : null
      const serviceId = booking.serviceIds.map((id) => mapping.externalToService.get(id)).find(Boolean) || null
      const customerNote = booking.customer && !clientId ? ` — client : ${booking.customer.name}` : ""
      // No mapped local service: keep the platform's own prestation and price visible
      // in the agenda through a display snapshot (its id is the external one, so the
      // booking stays non-reschedulable until a real prestation is set on its card).
      const durationMinutes = Math.round((Date.parse(booking.end) - Date.parse(booking.start)) / 60_000)
      const serviceItems = !serviceId && booking.priceCents > 0 && durationMinutes > 0
        ? [{
            id: booking.serviceIds[0] || booking.externalId,
            name: booking.serviceNames.join(" + ") || "Prestation",
            duration_minutes: durationMinutes,
            price_cents: Math.round(booking.priceCents),
            required_staff_count: staffIds.length || 1,
          }]
        : null
      const { data: appointment, error } = await supabase
        .from("appointments")
        .insert({
          salon_id: salonId,
          client_id: clientId,
          staff_id: staffIds[0],
          service_id: serviceId,
          ...(serviceItems ? { service_items: serviceItems } : {}),
          start_time: booking.start,
          end_time: booking.end,
          status: "confirmed",
          payment_status: "unpaid",
          payment_method: platform === "treatwell" ? "treatwell" : "on_site",
          amount_paid_cents: 0,
          internal_notes: `Réservé sur ${label} : ${booking.serviceNames.join(" + ")} (${booking.priceCents > 0 ? `${(booking.priceCents / 100).toFixed(2)} €` : "prix non communiqué"})${customerNote}`,
          source: platform,
        })
        .select("id")
        .single()
      if (error || !appointment) throw new Error(error?.message || "Rendez-vous non créé")
      try {
        await setAssignments(appointment.id, staffIds)
        const { error: linkInsertError } = await supabase.from("appointment_platform_links").insert({
          appointment_id: appointment.id, platform, external_id: booking.externalId, external_ref: booking.ref, origin: "pulled", snapshot: remoteState(booking),
        })
        if (linkInsertError) throw new Error(linkInsertError.message)
        linkedExternal.add(booking.externalId)
      } catch (followUp) {
        await supabase.from("appointments").delete().eq("id", appointment.id)
        throw followUp
      }
    })
  }

  // ---- 3. bookings only the site knows -------------------------------------

  // One line per masseuse rather than per booking: it is a mapping to fix once.
  const withoutColumn = new Map<string, number>()
  const withoutVenue = new Map<string, number>()
  for (const local of unlinkedLocals()) {
    if (local.source === platform || local.status === "cancelled" || local.status === "no_show" || Date.parse(local.end_time) < now) continue
    const venue = mapping.venueBySalon.get(local.salon_id)
    if (!venue) continue
    const columns = local.staffIds.map((id) => mapping.staffToExternal.get(id))
    const who = local.client ? `${local.client.first_name || ""} ${local.client.last_name || ""}`.trim() : null
    const detail = describe(local.start_time, local.salon_id, local.staffIds, localServiceName(local), who)
    if (!columns.length || columns.some((c) => !c)) {
      const missing = local.staffIds.filter((id) => !mapping.staffToExternal.has(id)).map((id) => mapping.names.staff.get(id) || id)
      for (const name of missing.length ? missing : ["sans masseuse"]) {
        const key = `${mapping.names.salons.get(local.salon_id) || "?"} · ${name}`
        withoutColumn.set(key, (withoutColumn.get(key) || 0) + 1)
      }
      continue
    }
    if (creates >= MAX_CREATES_PER_RUN) continue
    creates += 1

    // Pushed anyway so the slot is blocked and the clash is visible in the platform agenda.
    const clash = [...external.values()].find((b) => b.status === "active" && b.venueId === venue.id && !linkedExternal.has(b.externalId) &&
      Date.parse(b.start) < Date.parse(local.end_time) && Date.parse(b.end) > Date.parse(local.start_time) &&
      b.staff.some((id) => columns.includes(id)))
    if (clash) report.warnings.push(`${detail} — conflit : chevauche un rendez-vous ${label} de ${formatInTimeZone(new Date(clash.start), TIMEZONE, "HH:mm")} (double réservation à régler à la main)`)

    const externalId = adapter.newBookingId()
    const serviceIds = local.service_items?.length
      ? local.service_items.map((s) => s.id)
      : [local.service_id].filter((id): id is string => Boolean(id))
    const mappedService = serviceIds.length === 1 ? mapping.serviceToExternal.get(`${venue.id}:${serviceIds[0]}`) || null : null
    const priceCents = local.service_items?.length ? local.service_items.reduce((sum, s) => sum + s.price_cents, 0) : local.service?.price_cents || 0
    const state = localState(local, [])
    const input: PushBookingInput = {
      externalId,
      venueId: venue.id,
      start: state.start,
      durationMinutes: Math.round((Date.parse(state.end) - Date.parse(state.start)) / 60_000),
      staff: state.staff,
      serviceId: mappedService,
      // A booking pulled from the other platform may have neither a site service nor a client
      // card; its import note ("Réservé sur Treatwell : <prestation> (<prix>) — client : <nom>") says it all.
      // With both an imported prestation snapshot and a client card, the clean prestation name is enough.
      title: !local.service && local.internal_notes && (!local.client_id || !local.service_items?.length)
        ? local.internal_notes.slice(0, 160)
        : localServiceName(local),
      priceCents,
      customer: local.client
        ? { firstName: local.client.first_name || "", lastName: local.client.last_name || "", phone: local.client.phone, email: local.client.email }
        : null,
    }

    await attempt("push", detail, async () => {
      // Reserve the link first, with the ref the booking will land at: if this
      // run dies after the remote write, the next one can verify and adopt the
      // booking instead of creating it twice.
      const { data: reserved, error: reserveError } = await supabase
        .from("appointment_platform_links")
        .insert({ appointment_id: local.id, platform, external_id: externalId, origin: "pushed", snapshot: null, external_ref: adapter.pendingRef?.(input) || {} })
        .select("id")
        .single()
      if ((reserveError as { code?: string } | null)?.code === "23505") {
        linkedLocal.add(local.id) // a concurrent run linked this booking first
        return SKIP
      }
      if (reserveError || !reserved) throw new Error(reserveError?.message || "Lien non réservé")
      // On failure the pending link is kept, not deleted: the write may have
      // landed despite the error (timeout), and the next runs settle it — adopt
      // what exists, retry after PENDING_PUSH_MINUTES what provably doesn't.
      const ref = await adapter.createBooking(input)
      await updateLink(reserved.id, { snapshot: state, external_ref: ref })
      linkedLocal.add(local.id)
      linkedExternal.add(externalId)
    })
  }

  // Salons with no platform venue are outside `locals`; count what they would have sent so the gap is visible.
  const unmappedSalonIds = [...mapping.names.salons.keys()].filter((id) => !mapping.venueBySalon.has(id))
  if (unmappedSalonIds.length) {
    const { data: pending } = await supabase
      .from("appointments")
      .select("salon_id")
      .in("salon_id", unmappedSalonIds)
      .gte("start_time", new Date(now).toISOString())
      .lte("start_time", windowEnd)
      .in("status", ACTIVE_LOCAL)
      .neq("source", platform)
    for (const row of (pending || []) as { salon_id: string }[]) {
      const key = mapping.names.salons.get(row.salon_id) || row.salon_id
      withoutVenue.set(key, (withoutVenue.get(key) || 0) + 1)
    }
  }
  for (const [salon, count] of withoutVenue) {
    report.warnings.push(`${salon} — ${count} rendez-vous non envoyé${count > 1 ? "s" : ""} : aucun établissement ${label} associé à ce salon (même nom dans ${label}, ou ligne salon dans platform_mappings)`)
  }
  for (const [who, count] of withoutColumn) {
    report.warnings.push(`${who} — ${count} rendez-vous non envoyé${count > 1 ? "s" : ""} : aucune colonne ${label} associée (même prénom dans ${label}, ou ligne dans platform_mappings)`)
  }

  const backlog = [...external.values()].filter((b) => !linkedExternal.has(b.externalId)).length + unlinkedLocals().length
  if (creates >= MAX_CREATES_PER_RUN && backlog > 0) {
    report.warnings.push(`Limite de ${MAX_CREATES_PER_RUN} créations atteinte : la suite sera traitée aux prochains passages.`)
  }
}
