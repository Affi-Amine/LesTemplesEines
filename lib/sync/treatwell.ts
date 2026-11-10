import { randomBytes } from "crypto"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

import type { createAdminClient } from "@/lib/supabase/admin"
import { loadSession, saveSession } from "@/lib/sync/sessions"
import {
  PlatformUnavailableError,
  type BookingState,
  type ExternalBooking,
  type ExternalVenue,
  type PlatformAdapter,
  type PushBookingInput,
} from "@/lib/sync/types"

// Treatwell Connect (connect.treatwell.fr) is a web app over a JSON API on the
// same host (/api/venue/<venueId>/...). Everything below mirrors what that app
// does on the wire, as read from its bundle and traffic on 2026-11-01.
//
//  - Login: guarded by a Cloudflare Turnstile check that a person must pass,
//    so `npm run sync:login -- treatwell` opens Chrome for a human sign-in and
//    stores the « Rester connecté » cookies (ATKT ~3 months, ITKT ~1 year).
//    The API itself takes those cookies over plain HTTP; writes also send the
//    ITKT cookie as X-CSRF-TOKEN, like the app.
//  - Reading: calendar.json returns appointments (client bookings) and blocks.
//  - Writing: bookings from the site or Planity become single-day time blocks
//    on the masseuse's column, named after the service and the client and
//    tagged "[LT-<id>]". A block reserves the slot without creating a Treatwell
//    customer, an unpaid sale in the till or a message to the client.
//  - Treatwell's own appointments are never modified from here: moving or
//    cancelling one goes through Treatwell's payment, refund and notification
//    rules, so the sync reports it for the salon to do in Connect instead.

const ORIGIN = "https://connect.treatwell.fr"
const TIMEZONE = "Europe/Paris"
const TAG = /\s*\[LT-([A-Za-z0-9]+)\]\s*$/
/** calendar.json is read in slices this long, like the app's week view. */
const SLICE_DAYS = 14
const CANCELLED = ["CC", "RJ"]
const RELOGIN = "relancez `npm run sync:login -- treatwell` et reconnectez-vous"

export interface TreatwellSession {
  cookies: { name: string; value: string; domain: string; path: string; expires: number }[]
  userAgent?: string
  savedAt: string
}

interface TwAppointment {
  id: number
  appointmentDate: string
  startTime: string
  endTime: string
  appointmentStatusCode: string
  employeeId: number | null
  offerName?: string | null
  skus?: { skuId: number; skuName?: string | null }[] | null
  amount?: number | null
  walkIn?: boolean
  anonymousNote?: string | null
  consumerName?: string | null
  recipientName?: string | null
  consumerPhone?: string | null
  consumerEmail?: string | null
  created?: string | null
  updated?: string | null
}

interface TwBlock {
  id: string | number
  employeeId: number | null
  name?: string | null
  availabilityRuleTypeCode: string
  dateFrom: string
  dateTo?: string | null
  timeFrom: string
  timeTo: string
  itemDate?: string | null
  itemTimeFrom?: string | null
  itemTimeTo?: string | null
  updated?: string | null
}

interface TwCalendar {
  appointments?: TwAppointment[]
  blocks?: TwBlock[]
}

interface TwMenu {
  offers?: { id: number; name: string; skus?: { id: number; name?: string | null; duration?: number | null; fullPriceAmount?: number | null }[] }[]
}

type Ref =
  | { kind: "appointment"; venueId: string; id: number }
  | { kind: "block"; venueId: string; name: string; day: string; blocks: { id: string; employeeId: string }[] }

function parisToIso(day: string, time: string) {
  return fromZonedTime(`${day}T${time.slice(0, 5)}:00`, TIMEZONE).toISOString()
}

function isoToParis(iso: string) {
  const local = formatInTimeZone(new Date(iso), TIMEZONE, "yyyy-MM-dd HH:mm")
  return { day: local.slice(0, 10), time: local.slice(11) }
}

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

function fromAppointment(venueId: string, a: TwAppointment): ExternalBooking {
  const name = (a.walkIn ? a.anonymousNote : a.recipientName || a.consumerName)?.trim()
  return {
    externalId: `a${a.id}`,
    venueId,
    start: parisToIso(a.appointmentDate, a.startTime),
    end: parisToIso(a.appointmentDate, a.endTime),
    status: CANCELLED.includes(a.appointmentStatusCode) ? "cancelled" : "active",
    staff: a.employeeId ? [String(a.employeeId)] : [],
    serviceIds: (a.skus || []).map((sku) => String(sku.skuId)),
    serviceNames: [a.offerName || "Prestation"],
    priceCents: Math.round((a.amount || 0) * 100),
    customer: name ? { name, phone: a.walkIn ? null : a.consumerPhone || null, email: a.walkIn ? null : a.consumerEmail || null } : null,
    isOurs: false,
    updatedAt: Date.parse(a.updated || a.created || "") || 0,
    ref: { kind: "appointment", venueId, id: a.id } satisfies Ref,
  }
}

/** Our blocks, grouped by tag: a booking with two masseuses is one block per column. */
function fromBlocks(venueId: string, blocks: TwBlock[]): ExternalBooking[] {
  const byTag = new Map<string, TwBlock[]>()
  for (const block of blocks) {
    const tag = block.name?.match(TAG)?.[1]
    if (tag && block.employeeId && block.availabilityRuleTypeCode === "D") byTag.set(tag, [...(byTag.get(tag) || []), block])
  }
  return [...byTag].map(([tag, group]) => {
    const day = group[0].itemDate || group[0].dateFrom
    const starts = group.map((b) => parisToIso(b.itemDate || b.dateFrom, b.itemTimeFrom || b.timeFrom)).sort()
    const ends = group.map((b) => parisToIso(b.itemDate || b.dateFrom, b.itemTimeTo || b.timeTo)).sort()
    const name = group[0].name || ""
    return {
      externalId: tag,
      venueId,
      start: starts[0],
      end: ends.at(-1)!,
      status: "active",
      staff: [...new Set(group.map((b) => String(b.employeeId)))].sort(),
      serviceIds: [],
      serviceNames: [name.replace(TAG, "")],
      priceCents: 0,
      customer: null,
      isOurs: true,
      updatedAt: Math.max(...group.map((b) => Date.parse(b.updated || "") || 0)),
      ref: { kind: "block", venueId, name, day, blocks: group.map((b) => ({ id: String(b.id), employeeId: String(b.employeeId) })) } satisfies Ref,
    }
  })
}

function blockName(input: PushBookingInput) {
  const client = input.customer ? [`${input.customer.firstName} ${input.customer.lastName}`.trim(), input.customer.phone].filter(Boolean).join(" ") : ""
  // Treatwell shows the block name in the agenda; the tag must survive any trimming.
  const label = [input.title, client].filter(Boolean).join(" · ").slice(0, 180)
  return `${label} [LT-${input.externalId}]`
}

export function createTreatwellAdapter(supabase: ReturnType<typeof createAdminClient>): PlatformAdapter {
  let session: TreatwellSession | null = null

  async function currentSession() {
    if (!session) {
      session = await loadSession<TreatwellSession>(supabase, "treatwell")
      if (!session?.cookies?.length) throw new PlatformUnavailableError("treatwell", `Aucune session Treatwell : ${RELOGIN}.`)
    }
    return session
  }

  /** The API refreshes its tokens through Set-Cookie; keep what it sends so the session lasts. */
  async function absorbCookies(response: Response) {
    const updates = response.headers.getSetCookie?.() || []
    if (!updates.length || !session) return
    let changed = false
    for (const header of updates) {
      const [pair, ...attributes] = header.split(";")
      const name = pair.slice(0, pair.indexOf("=")).trim()
      const value = pair.slice(pair.indexOf("=") + 1).trim()
      const maxAge = attributes.find((a) => /^\s*max-age=/i.test(a))
      const expiresAttr = attributes.find((a) => /^\s*expires=/i.test(a))
      const expires = maxAge ? Date.now() / 1000 + Number(maxAge.split("=")[1]) : expiresAttr ? Date.parse(expiresAttr.split("=")[1]) / 1000 : -1
      const existing = session.cookies.find((c) => c.name === name)
      if (existing?.value === value) continue
      changed = true
      if (existing) Object.assign(existing, { value, expires })
      else session.cookies.push({ name, value, domain: ".treatwell.fr", path: "/", expires })
    }
    if (changed) await saveSession(supabase, "treatwell", { ...session, savedAt: new Date().toISOString() })
  }

  async function call<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T | null> {
    const { cookies, userAgent } = await currentSession()
    const now = Date.now() / 1000
    const jar = cookies.filter((c) => c.expires <= 0 || c.expires > now)
    const csrf = jar.find((c) => c.name.endsWith("ITKT"))?.value
    const response = await fetch(`${ORIGIN}${path}`, {
      method,
      redirect: "manual",
      headers: {
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
        cookie: jar.map((c) => `${c.name}=${c.value}`).join("; "),
        ...(userAgent ? { "user-agent": userAgent } : {}),
        ...(method === "GET" ? {} : { "content-type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    await absorbCookies(response)
    const text = await response.text()
    if (response.headers.get("cf-mitigated") || /^\s*</.test(text)) {
      throw new PlatformUnavailableError("treatwell", `Treatwell a répondu par une page de vérification au lieu de données : ${RELOGIN}.`)
    }
    if (response.status === 401 || (response.status >= 300 && response.status < 400)) {
      throw new PlatformUnavailableError("treatwell", `Session Treatwell expirée : ${RELOGIN}.`)
    }
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Treatwell ${method} ${path.split("?")[0]} -> ${response.status} ${text.slice(0, 200)}`)
    return text ? (JSON.parse(text) as T) : null
  }

  async function calendar(venueId: string, fromDay: string, toDay: string) {
    const query = new URLSearchParams({
      "date-from": fromDay,
      "date-to": toDay,
      include: "appointments,blocks",
      "appointment-status-codes": "CR,CN,NS,CP,CC",
    })
    return (await call<TwCalendar>("GET", `/api/venue/${venueId}/calendar.json?${query}`)) || {}
  }

  function blockBody(employeeId: string, name: string, state: { start: string; end: string }) {
    const start = isoToParis(state.start)
    const end = isoToParis(state.end)
    return {
      dateFrom: start.day,
      timeFrom: start.time,
      dateTo: start.day,
      // A booking ending at midnight is 24:00 on its own day, not 00:00 the next.
      timeTo: end.day === start.day ? end.time : "24:00",
      name,
      availabilityRuleTypeCode: "D",
      weekDays: [],
      employeeId: Number(employeeId),
    }
  }

  async function createBlock(venueId: string, employeeId: string, name: string, state: { start: string; end: string }) {
    const created = await call<{ id: string | number }>("POST", `/api/venue/${venueId}/time-block.json`, blockBody(employeeId, name, state))
    if (!created?.id) throw new Error("Treatwell n'a pas renvoyé l'identifiant du blocage créé")
    return { id: String(created.id), employeeId }
  }

  const appointmentOnly = (action: string) =>
    new Error(`Réservation client Treatwell : ${action} dans Treatwell Connect (paiement, remboursement et messages au client y sont gérés)`)

  return {
    platform: "treatwell",

    async listVenues() {
      const { cookies } = await currentSession()
      const current = cookies.find((c) => c.name === "extranet.currentVenueId")?.value || process.env.TREATWELL_VENUE_ID
      if (!current) throw new PlatformUnavailableError("treatwell", `Établissement Treatwell inconnu : ${RELOGIN}.`)
      const settings = await call<{ venues?: { id: number; name: string }[] }>("GET", `/api/venue/${decodeURIComponent(current)}/extranet-settings.json`)
      const venues: ExternalVenue[] = []
      for (const venue of settings?.venues || []) {
        const [team, menu] = await Promise.all([
          call<{ employees?: { id: number; name: string }[] }>("GET", `/api/venue/${venue.id}/employees.json?active=true&takes-appointments=true`),
          call<TwMenu>("GET", `/api/venue/${venue.id}/menu.json?filter=ALL&include=skus`),
        ])
        venues.push({
          id: String(venue.id),
          name: venue.name.trim(),
          staff: (team?.employees || []).map((e) => ({ id: String(e.id), name: e.name.trim() })),
          services: (menu?.offers || []).flatMap((offer) =>
            (offer.skus || []).map((sku) => ({
              id: String(sku.id),
              name: offer.name.trim(),
              durationMinutes: sku.duration || 0,
              priceCents: Math.round((sku.fullPriceAmount || 0) * 100),
            }))
          ),
        })
      }
      return venues
    },

    async listBookings(venue, fromDay, toDay) {
      const bookings: ExternalBooking[] = []
      for (let day = fromDay; day <= toDay; day = addDays(day, SLICE_DAYS)) {
        const last = addDays(day, SLICE_DAYS - 1) < toDay ? addDays(day, SLICE_DAYS - 1) : toDay
        const { appointments = [], blocks = [] } = await calendar(venue.id, day, last)
        bookings.push(...appointments.map((a) => fromAppointment(venue.id, a)), ...fromBlocks(venue.id, blocks))
      }
      return bookings
    },

    async getBooking(rawRef) {
      const ref = rawRef as Ref
      if (ref.kind === "appointment") {
        const appointment = await call<TwAppointment>("GET", `/api/venue/${ref.venueId}/appointment/${ref.id}.json`)
        return appointment ? fromAppointment(ref.venueId, appointment) : null
      }
      const { blocks = [] } = await calendar(ref.venueId, ref.day, ref.day)
      const ids = new Set(ref.blocks.map((b) => b.id))
      // A pending ref has no block ids yet (Treatwell assigns them): find the
      // blocks by the [LT-<id>] tag carried in the name instead.
      const tag = ids.size ? null : ref.name.match(TAG)?.[1]
      const mine = ids.size ? blocks.filter((b) => ids.has(String(b.id))) : blocks.filter((b) => Boolean(tag) && b.name?.match(TAG)?.[1] === tag)
      return fromBlocks(ref.venueId, mine)[0] || null
    },

    newBookingId: () => randomBytes(6).toString("hex"),

    /** Where a push with this input will land: lets a later run verify a write whose confirmation was lost. */
    pendingRef: (input) =>
      ({ kind: "block", venueId: input.venueId, name: blockName(input), day: isoToParis(input.start).day, blocks: [] }) satisfies Ref,

    async createBooking(input) {
      const name = blockName(input)
      const state = { start: input.start, end: new Date(Date.parse(input.start) + input.durationMinutes * 60_000).toISOString() }
      const blocks: { id: string; employeeId: string }[] = []
      try {
        for (const employeeId of input.staff) blocks.push(await createBlock(input.venueId, employeeId, name, state))
      } catch (error) {
        // All columns or none: a half-created duo would read back as a different booking.
        for (const block of blocks) await call("DELETE", `/api/venue/${input.venueId}/time-block/${block.id}.json`).catch(() => {})
        throw error
      }
      return { kind: "block", venueId: input.venueId, name, day: isoToParis(input.start).day, blocks } satisfies Ref
    },

    async updateBooking(rawRef, next: BookingState) {
      const ref = rawRef as Ref
      if (ref.kind === "appointment") throw appointmentOnly("déplacement à faire")
      const kept: { id: string; employeeId: string }[] = []
      for (const block of ref.blocks) {
        if (next.staff.includes(block.employeeId)) {
          await call("PUT", `/api/venue/${ref.venueId}/time-block/${block.id}.json`, {
            ...blockBody(block.employeeId, ref.name, next),
            updateTypeCode: "D",
            actionDate: ref.day,
          })
          kept.push(block)
        } else {
          await call("DELETE", `/api/venue/${ref.venueId}/time-block/${block.id}.json`)
        }
      }
      for (const employeeId of next.staff.filter((id) => !kept.some((b) => b.employeeId === id))) {
        kept.push(await createBlock(ref.venueId, employeeId, ref.name, next))
      }
      return { ...ref, day: isoToParis(next.start).day, blocks: kept } satisfies Ref
    },

    async cancelBooking(rawRef) {
      const ref = rawRef as Ref
      if (ref.kind === "appointment") throw appointmentOnly("annulation à faire")
      for (const block of ref.blocks) await call("DELETE", `/api/venue/${ref.venueId}/time-block/${block.id}.json`)
    },
  }
}
