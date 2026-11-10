import type { createAdminClient } from "@/lib/supabase/admin"
import { nameKey, namesMatch, nameSimilarity, pairUnique } from "@/lib/sync/matching"
import type { ExternalVenue, Platform } from "@/lib/sync/types"

type SupabaseClient = ReturnType<typeof createAdminClient>

interface LocalSalon { id: string; name: string }
interface LocalStaff { id: string; salon_id: string; first_name: string | null; last_name: string | null }
interface LocalService { id: string; name: string; duration_minutes: number }
interface Override { kind: "salon" | "staff" | "service"; local_id: string; external_id: string | null; external_venue_id: string }

export interface PlatformMapping {
  venueBySalon: Map<string, ExternalVenue>
  salonByVenue: Map<string, string>
  /** local staff id -> agenda column id */
  staffToExternal: Map<string, string>
  /** agenda column id -> local staff id */
  externalToStaff: Map<string, string>
  /** `${venueId}:${localServiceId}` -> platform service id */
  serviceToExternal: Map<string, string>
  /** platform service id -> local service id */
  externalToService: Map<string, string>
  names: { salons: Map<string, string>; staff: Map<string, string>; columns: Map<string, string> }
  summary: {
    salons: { salon: string; venue: string }[]
    unmappedVenues: string[]
    staff: { salon: string; staff: string; column: string }[]
    unmappedColumns: string[]
    services: number
  }
}

export function staffLabel(staff: Pick<LocalStaff, "first_name" | "last_name">) {
  // Staff records are "Madame <name>": the name that matches the agenda column is last_name.
  return nameKey(staff.last_name) ? (staff.last_name || "").trim() : (staff.first_name || "").trim()
}

export async function resolveMapping(supabase: SupabaseClient, platform: Platform, venues: ExternalVenue[]): Promise<PlatformMapping> {
  const [salonsResult, staffResult, servicesResult, serviceSalonsResult, overridesResult] = await Promise.all([
    supabase.from("salons").select("id, name").eq("is_active", true),
    supabase.from("staff").select("id, salon_id, first_name, last_name").eq("is_active", true),
    supabase.from("services").select("id, name, duration_minutes").eq("is_active", true),
    supabase.from("service_salons").select("service_id, salon_id"),
    supabase.from("platform_mappings").select("kind, local_id, external_id, external_venue_id").eq("platform", platform),
  ])
  for (const result of [salonsResult, staffResult, servicesResult, serviceSalonsResult, overridesResult]) {
    if (result.error) throw new Error(result.error.message)
  }
  const salons = salonsResult.data as LocalSalon[]
  const staff = staffResult.data as LocalStaff[]
  const services = servicesResult.data as LocalService[]
  const overrides = overridesResult.data as Override[]
  const override = (kind: Override["kind"], localId: string, venueId?: string) =>
    overrides.find((o) => o.kind === kind && o.local_id === localId && (venueId === undefined || o.external_venue_id === venueId))

  const mapping: PlatformMapping = {
    venueBySalon: new Map(),
    salonByVenue: new Map(),
    staffToExternal: new Map(),
    externalToStaff: new Map(),
    serviceToExternal: new Map(),
    externalToService: new Map(),
    names: {
      salons: new Map(salons.map((s) => [s.id, s.name.trim()])),
      staff: new Map(staff.map((s) => [s.id, staffLabel(s)])),
      columns: new Map(venues.flatMap((v) => v.staff.map((c) => [c.id, c.name] as const))),
    },
    summary: { salons: [], unmappedVenues: [], staff: [], unmappedColumns: [], services: 0 },
  }

  const autoSalons = pairUnique(salons, venues, (s, v) => (nameKey(s.name) === nameKey(v.name) ? 1 : 0), 1)
  for (const salon of salons) {
    const manual = override("salon", salon.id)
    const venue = manual ? venues.find((v) => v.id === manual.external_id) : autoSalons.get(salon)
    if (!venue) continue
    mapping.venueBySalon.set(salon.id, venue)
    mapping.salonByVenue.set(venue.id, salon.id)
    mapping.summary.salons.push({ salon: salon.name.trim(), venue: venue.name })
  }
  mapping.summary.unmappedVenues = venues.filter((v) => !mapping.salonByVenue.has(v.id)).map((v) => v.name)

  for (const [salonId, venue] of mapping.venueBySalon) {
    const team = staff.filter((s) => s.salon_id === salonId)
    // An exactly identical name outranks a one-typo match: "Toui" must pair
    // with "Toui" even though "Moui" is only one letter away.
    const autoStaff = pairUnique(
      team,
      venue.staff,
      (s, c) => (nameKey(staffLabel(s)) === nameKey(c.name) ? 2 : namesMatch(staffLabel(s), c.name) ? 1 : 0),
      1
    )
    for (const member of team) {
      const manual = override("staff", member.id, venue.id)
      const column = manual ? venue.staff.find((c) => c.id === manual.external_id) : autoStaff.get(member)
      if (!column) continue
      mapping.staffToExternal.set(member.id, column.id)
      mapping.externalToStaff.set(column.id, member.id)
      mapping.summary.staff.push({ salon: venue.name, staff: staffLabel(member), column: column.name })
    }
    mapping.summary.unmappedColumns.push(
      ...venue.staff.filter((c) => !mapping.externalToStaff.has(c.id)).map((c) => `${venue.name} · ${c.name}`)
    )

    const offered = new Set((serviceSalonsResult.data || []).filter((r) => r.salon_id === salonId).map((r) => r.service_id))
    const menu = services.filter((s) => offered.has(s.id))
    const autoServices = pairUnique(
      menu,
      venue.services,
      (local, remote) => (local.duration_minutes === remote.durationMinutes ? nameSimilarity(local.name, remote.name) : 0),
      0.5
    )
    for (const service of menu) {
      const manual = override("service", service.id, venue.id)
      const remote = manual ? venue.services.find((r) => r.id === manual.external_id) : autoServices.get(service)
      if (!remote) continue
      mapping.serviceToExternal.set(`${venue.id}:${service.id}`, remote.id)
      if (!mapping.externalToService.has(remote.id)) mapping.externalToService.set(remote.id, service.id)
      mapping.summary.services += 1
    }
  }

  return mapping
}
