import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

import type { createAdminClient } from "@/lib/supabase/admin"
import { loadCredentials } from "@/lib/sync/credentials"
import { loadSession, saveSession } from "@/lib/sync/sessions"
import { toE164 } from "@/lib/sync/matching"
import {
  PlatformUnavailableError,
  type BookingState,
  type ExternalBooking,
  type ExternalVenue,
  type PlatformAdapter,
  type PushBookingInput,
} from "@/lib/sync/types"

// Planity Pro (pro.planity.com) is a web app on top of Firebase. Everything
// below mirrors what that app does on the wire, as captured on 2026-10-30:
//
//  - Login: Firebase signInWithPassword -> AWS `getProAuthToken` (adds the
//    business claims) -> signInWithCustomToken. The refresh token keeps those
//    claims, so later runs only refresh it.
//  - Data: Firebase Realtime Database, sharded. Business config lives on the
//    public DB; agendas and customers on the shard named by `business.db`.
//  - Each agenda column is a "calendar"; appointments are "vevents" stored at
//    calendar_vevents/<calendarId>/<veventId> (a duo is one vevent stored under
//    both columns with ca="calA,calB"). Cancelling sets dat/dby, like the app.

const FIREBASE_KEY = process.env.PLANITY_FIREBASE_API_KEY || "AIzaSyDrSE1PzMwLKyhEvh2x8eV7s1NYwKGRC5Q"
const PRO_API = "https://product.api.euwest1.prod.planityapp.com"
const SHARD_LOOKUP = "https://dffgcccimeiln.cloudfront.net"
const PUBLIC_DB = "https://planity-production-public.firebaseio.com"
const TIMEZONE = "Europe/Paris"

/** Written as `cby` on every vevent we create; tells our bookings apart on the way back. */
export const PLANITY_AUTHOR = "Les Temples"

/** Short field names used by Planity (from the app's own mapping table). */
interface Vevent {
  ca: string // calendars, comma-separated
  s: string // "YYYY-MM-DD HH:mm", Paris time
  st?: number // start, minutes since midnight
  d: number // duration, minutes
  se?: string // service id
  sq?: string // sequence: the booking this step belongs to
  p?: number // price, cents
  t?: string // title, when there is no service
  cu?: { d?: boolean; id?: string; name?: string; phone?: string; email?: string }
  cby?: string
  cat?: number
  uat?: number
  dat?: number // deleted (cancelled) at
  dby?: string
  abs?: unknown // absence: staff time off, not a booking
}

interface PlanitySession {
  uid: string
  refreshToken: string
}

interface PlanityBusiness {
  name: string
  db?: string
  calendars?: Record<string, { children?: Record<string, { name: string; deletedAt?: number }> }>
  services?: Record<string, { children?: Record<string, { name: string; duration?: number; prices?: { default?: number }; deletedAt?: number }> }>
}

const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"

/** Firebase push id: 8 time chars + 12 random chars, same as the client SDK. */
function pushId(now = Date.now()) {
  let time = ""
  for (let i = 0; i < 8; i++) {
    time = PUSH_CHARS[now % 64] + time
    now = Math.floor(now / 64)
  }
  let random = ""
  for (let i = 0; i < 12; i++) random += PUSH_CHARS[Math.floor(Math.random() * 64)]
  return time + random
}

function shardUrl(shard: string) {
  return `https://planity-production-${shard}.europe-west1.firebasedatabase.app`
}

function parisToIso(local: string) {
  return fromZonedTime(`${local}:00`, TIMEZONE).toISOString()
}

function isoToParis(iso: string) {
  const s = formatInTimeZone(new Date(iso), TIMEZONE, "yyyy-MM-dd HH:mm")
  return { s, st: Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)) }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://pro.planity.com", referer: "https://pro.planity.com/" },
    body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${url.split("?")[0]} -> ${response.status} ${JSON.stringify(json).slice(0, 200)}`)
  return json as T
}

export function createPlanityAdapter(supabase: ReturnType<typeof createAdminClient>): PlatformAdapter {
  let idToken: string | null = null
  let uid: string | null = null
  const shards = new Map<string, string>()
  const businesses = new Map<string, PlanityBusiness>()

  async function login() {
    const { credentials } = await loadCredentials(supabase, "planity")
    if (!credentials) {
      throw new PlatformUnavailableError("planity", "Identifiants Planity manquants : saisissez-les dans Administration › Synchronisation (ou PLANITY_USERNAME / PLANITY_PASSWORD)")
    }
    let first: { localId: string; idToken: string }
    try {
      first = await postJson<{ localId: string; idToken: string }>(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
        { email: credentials.username, password: credentials.password, returnSecureToken: true, clientType: "CLIENT_TYPE_WEB" }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|USER_DISABLED/.test(message)) {
        throw new PlatformUnavailableError("planity", "Planity refuse l'identifiant ou le mot de passe : vérifiez-les dans Administration › Synchronisation")
      }
      throw error
    }
    const { token } = await postJson<{ token: string }>(`${PRO_API}/getProAuthToken`, {
      uid: first.localId, token: first.idToken, idToken: first.idToken, isBusinessSharded: true, isUserSharded: true, source: "web",
    })
    const session = await postJson<{ idToken: string; refreshToken: string }>(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_KEY}`,
      { token, returnSecureToken: true }
    )
    await saveSession(supabase, "planity", { uid: first.localId, refreshToken: session.refreshToken } satisfies PlanitySession)
    return { uid: first.localId, idToken: session.idToken }
  }

  async function refresh(saved: PlanitySession) {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: saved.refreshToken }),
    })
    if (!response.ok) return null
    const json = await response.json()
    if (json.refresh_token && json.refresh_token !== saved.refreshToken) {
      await saveSession(supabase, "planity", { uid: saved.uid, refreshToken: json.refresh_token } satisfies PlanitySession)
    }
    return { uid: saved.uid, idToken: json.id_token as string }
  }

  async function auth() {
    if (idToken && uid) return { idToken, uid }
    const saved = await loadSession<PlanitySession>(supabase, "planity")
    const result = (saved && (await refresh(saved))) || (await login())
    idToken = result.idToken
    uid = result.uid
    return result
  }

  async function db<T>(base: string, path: string, query: Record<string, string> = {}, init?: RequestInit): Promise<T> {
    const { idToken: token } = await auth()
    const params = new URLSearchParams({ auth: token, ...query })
    const response = await fetch(`${base}/${path}.json?${params}`, init)
    const json = await response.json().catch(() => null)
    if (!response.ok) throw new Error(`Planity ${init?.method || "GET"} ${path} -> ${response.status} ${JSON.stringify(json).slice(0, 200)}`)
    return json as T
  }

  async function shardOf(id: string, fallback?: string) {
    if (!shards.has(id)) {
      const response = await fetch(`${SHARD_LOOKUP}/?businessOrCalendarId=${encodeURIComponent(id)}`)
      const json = response.ok ? await response.json() : null
      const shard = json?.shardName && json.shardName !== "master" ? json.shardName : fallback
      if (!shard) throw new Error(`Planity: shard inconnu pour ${id}`)
      shards.set(id, shard)
    }
    return shardUrl(shards.get(id)!)
  }

  async function business(id: string) {
    if (!businesses.has(id)) {
      const value = await db<PlanityBusiness>(PUBLIC_DB, `businesses/${id}`)
      if (!value) throw new Error(`Planity: établissement ${id} introuvable`)
      businesses.set(id, value)
    }
    return businesses.get(id)!
  }

  /** Groups updates by shard: a multi-path PATCH can't span databases. */
  async function write(updates: { base: string; path: string; value: unknown }[]) {
    const byBase = new Map<string, Record<string, unknown>>()
    for (const { base, path, value } of updates) byBase.set(base, { ...(byBase.get(base) || {}), [path]: value })
    for (const [base, body] of byBase) {
      await db(base, "", {}, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    }
  }

  function toBooking(venueId: string, entries: { id: string; vevent: Vevent }[], biz: PlanityBusiness): ExternalBooking {
    const live = entries.filter((e) => !e.vevent.dat)
    const counted = live.length ? live : entries
    const starts = counted.map((e) => parisToIso(e.vevent.s))
    const ends = counted.map((e) => new Date(Date.parse(parisToIso(e.vevent.s)) + e.vevent.d * 60_000).toISOString())
    const services = Object.values(biz.services || {}).flatMap((group) => Object.entries(group.children || {}))
    const serviceIds = counted.map((e) => e.vevent.se).filter((id): id is string => Boolean(id))
    const customer = entries.map((e) => e.vevent.cu).find((cu) => cu && !cu.d && cu.name)
    return {
      externalId: entries[0].vevent.sq || entries[0].id,
      venueId,
      start: starts.sort()[0],
      end: ends.sort().at(-1)!,
      status: live.length ? "active" : "cancelled",
      staff: [...new Set(counted.flatMap((e) => e.vevent.ca.split(",").filter(Boolean)))].sort(),
      serviceIds,
      // A slot booked without a Planity service carries its title instead.
      serviceNames: serviceIds.length
        ? serviceIds.map((id) => services.find(([sid]) => sid === id)?.[1].name || entries.find((e) => e.vevent.se === id)?.vevent.t || "Prestation")
        : counted.map((e) => e.vevent.t).filter((title): title is string => Boolean(title)),
      priceCents: counted.reduce((sum, e) => sum + (e.vevent.p || 0), 0),
      customer: customer ? { name: customer.name!, phone: customer.phone || null, email: customer.email || null } : null,
      isOurs: entries.some((e) => e.vevent.cby === PLANITY_AUTHOR),
      updatedAt: Math.max(...entries.map((e) => e.vevent.uat || e.vevent.cat || 0)),
      ref: {
        businessId: venueId,
        customerId: customer?.id || null,
        vevents: entries.map((e) => ({ id: e.id, calendars: e.vevent.ca.split(",").filter(Boolean) })),
      },
    }
  }

  async function findCustomer(businessId: string, base: string, phone: string | null) {
    for (const variant of [toE164(phone), phone].filter((v): v is string => Boolean(v))) {
      const found = await db<Record<string, unknown> | null>(base, `business_customers/${businessId}`, { orderBy: '"phone"', equalTo: JSON.stringify(variant) })
      const id = found && Object.keys(found)[0]
      if (id) return id
    }
    return null
  }

  type Ref = { businessId: string; customerId: string | null; vevents: { id: string; calendars: string[] }[] }

  /**
   * Reads a vevent where we last saw it and returns the columns it lives in
   * now. Writes must only target those: a partial write (e.g. just `dat`) to a
   * column the salon has since moved it away from would create a broken entry
   * in that column.
   */
  async function readVevent(biz: PlanityBusiness, id: string, calendars: string[]) {
    for (const calendar of calendars) {
      const vevent = await db<Vevent | null>(await shardOf(calendar, biz.db), `calendar_vevents/${calendar}/${id}`)
      if (vevent?.ca) return { vevent, calendars: vevent.ca.split(",").filter(Boolean) }
    }
    return null
  }

  return {
    platform: "planity",

    async login() {
      idToken = null
      uid = null
      const result = await login()
      idToken = result.idToken
      uid = result.uid
    },

    async listVenues() {
      const { uid: me } = await auth()
      const acl = await db<{ businesses?: Record<string, boolean> }>(PUBLIC_DB, `pros_acls/${me}`)
      const venues: ExternalVenue[] = []
      for (const id of Object.keys(acl?.businesses || {})) {
        const biz = await business(id)
        if (biz.db) shards.set(id, biz.db)
        venues.push({
          id,
          name: biz.name.trim(),
          staff: Object.values(biz.calendars || {}).flatMap((group) =>
            Object.entries(group.children || {}).filter(([, c]) => !c.deletedAt).map(([cid, c]) => ({ id: cid, name: c.name.trim() }))
          ),
          services: Object.values(biz.services || {}).flatMap((group) =>
            Object.entries(group.children || {})
              .filter(([, s]) => !s.deletedAt)
              .map(([sid, s]) => ({ id: sid, name: s.name.trim(), durationMinutes: s.duration || 0, priceCents: s.prices?.default || 0 }))
          ),
        })
      }
      return venues
    },

    async listBookings(venue, fromDay, toDay) {
      const biz = await business(venue.id)
      const byId = new Map<string, Vevent>()
      await Promise.all(
        venue.staff.map(async ({ id }) => {
          const base = await shardOf(id, biz.db)
          const vevents = await db<Record<string, Vevent> | null>(base, `calendar_vevents/${id}`, {
            orderBy: '"s"', startAt: JSON.stringify(fromDay), endAt: JSON.stringify(`${toDay}`),
          })
          for (const [vid, vevent] of Object.entries(vevents || {})) if (vevent && !vevent.abs) byId.set(vid, vevent)
        })
      )
      const sequences = new Map<string, { id: string; vevent: Vevent }[]>()
      for (const [id, vevent] of byId) {
        // Blocks with neither a service nor a customer are not bookings.
        if (!vevent.se && (!vevent.cu || vevent.cu.d)) continue
        const key = vevent.sq || id
        sequences.set(key, [...(sequences.get(key) || []), { id, vevent }])
      }
      return [...sequences.values()].map((entries) => toBooking(venue.id, entries, biz))
    },

    async getBooking(rawRef) {
      const ref = rawRef as Ref
      const biz = await business(ref.businessId)
      const entries: { id: string; vevent: Vevent }[] = []
      for (const { id, calendars } of ref.vevents) {
        const found = await readVevent(biz, id, calendars)
        if (found) entries.push({ id, vevent: found.vevent })
      }
      return entries.length ? toBooking(ref.businessId, entries, biz) : null
    },

    newBookingId: () => pushId(),

    async createBooking(input: PushBookingInput) {
      const biz = await business(input.venueId)
      const customersBase = await shardOf(input.venueId, biz.db)
      const now = Date.now()
      const calendars = input.staff.join(",")
      const updates: { base: string; path: string; value: unknown }[] = []

      let cu: Vevent["cu"] = { d: true }
      let customerId: string | null = null
      if (input.customer) {
        const name = `${input.customer.firstName} ${input.customer.lastName}`.trim()
        const phone = toE164(input.customer.phone)
        customerId = await findCustomer(input.venueId, customersBase, phone)
        if (customerId) {
          updates.push({ base: customersBase, path: `business_customers/${input.venueId}/${customerId}/vevents/${input.externalId}`, value: calendars })
        } else {
          customerId = pushId()
          updates.push({
            base: customersBase,
            path: `business_customers/${input.venueId}/${customerId}`,
            value: {
              createdAt: now, name, firstName: input.customer.firstName, lastName: input.customer.lastName,
              ...(phone ? { phone } : {}), ...(input.customer.email ? { email: input.customer.email } : {}),
              vevents: { [input.externalId]: calendars },
            },
          })
        }
        cu = { d: false, id: customerId, name, ...(phone ? { phone } : {}), ...(input.customer.email ? { email: input.customer.email } : {}) }
      }

      const { s, st } = isoToParis(input.start)
      const vevent: Vevent = {
        ca: calendars, cat: now, cby: PLANITY_AUTHOR, cu, d: input.durationMinutes, p: input.priceCents,
        s, st, sq: input.externalId, uat: now,
        ...(input.serviceId ? { se: input.serviceId } : { t: input.title }),
      }
      for (const calendar of input.staff) {
        updates.push({ base: await shardOf(calendar, biz.db), path: `calendar_vevents/${calendar}/${input.externalId}`, value: vevent })
      }
      await write(updates)
      return { businessId: input.venueId, customerId, vevents: [{ id: input.externalId, calendars: input.staff }] } satisfies Ref
    },

    async updateBooking(rawRef, next: BookingState) {
      const ref = rawRef as Ref
      if (ref.vevents.length !== 1) throw new Error("Rendez-vous Planity en plusieurs étapes : modification à reporter à la main")
      const biz = await business(ref.businessId)
      const [{ id, calendars: lastSeen }] = ref.vevents
      const found = await readVevent(biz, id, lastSeen)
      if (!found) throw new Error("Rendez-vous introuvable sur Planity")
      const { vevent: current, calendars: previous } = found

      const { s, st } = isoToParis(next.start)
      const updated: Vevent = { ...current, s, st, d: Math.round((Date.parse(next.end) - Date.parse(next.start)) / 60_000), ca: next.staff.join(","), uat: Date.now() }
      const updates: { base: string; path: string; value: unknown }[] = []
      for (const calendar of previous.filter((c) => !next.staff.includes(c))) {
        updates.push({ base: await shardOf(calendar, biz.db), path: `calendar_vevents/${calendar}/${id}`, value: null })
      }
      for (const calendar of next.staff) {
        updates.push({ base: await shardOf(calendar, biz.db), path: `calendar_vevents/${calendar}/${id}`, value: updated })
      }
      if (ref.customerId) {
        updates.push({ base: await shardOf(ref.businessId, biz.db), path: `business_customers/${ref.businessId}/${ref.customerId}/vevents/${id}`, value: updated.ca })
      }
      await write(updates)
      return { ...ref, vevents: [{ id, calendars: next.staff }] } satisfies Ref
    },

    async cancelBooking(rawRef) {
      const ref = rawRef as Ref
      const biz = await business(ref.businessId)
      const now = Date.now()
      const updates: { base: string; path: string; value: unknown }[] = []
      for (const { id, calendars: lastSeen } of ref.vevents) {
        const found = await readVevent(biz, id, lastSeen)
        if (!found || found.vevent.dat) continue
        for (const calendar of found.calendars) {
          const base = await shardOf(calendar, biz.db)
          updates.push({ base, path: `calendar_vevents/${calendar}/${id}/dat`, value: now })
          updates.push({ base, path: `calendar_vevents/${calendar}/${id}/dby`, value: PLANITY_AUTHOR })
          updates.push({ base, path: `calendar_vevents/${calendar}/${id}/uat`, value: now })
        }
        if (ref.customerId) {
          updates.push({ base: await shardOf(ref.businessId, biz.db), path: `business_customers/${ref.businessId}/${ref.customerId}/vevents/${id}`, value: null })
        }
      }
      await write(updates)
    },
  }
}
