export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SalonIdentity {
  id: string
  slug?: string | null
  name?: string | null
  is_active?: boolean | null
  opening_hours?: Record<string, { open: string; close: string }> | null
}

export interface ResolvedSalonGroup {
  salon: SalonIdentity
  salonIds: string[]
}

export function isUUID(value: string) {
  return UUID_REGEX.test(value)
}

export function normalizeSalonValue(value?: string | null) {
  return value?.trim().toLowerCase() || ""
}

export async function resolveSalonGroup(
  supabase: any,
  idOrSlug: string
): Promise<ResolvedSalonGroup | null> {
  const value = idOrSlug.trim()
  if (!value) return null

  let targetQuery = supabase
    .from("salons")
    .select("id, slug, name, is_active, opening_hours")

  // UUIDs identify records; slugs are normalized only at this public boundary.
  if (isUUID(value)) targetQuery = targetQuery.eq("id", value)
  const { data: matches, error } = await targetQuery

  if (error) {
    throw new Error(error.message)
  }

  const candidates: SalonIdentity[] = (Array.isArray(matches) ? matches : matches ? [matches] : [])
    .filter(salon => isUUID(value) || normalizeSalonValue(salon.slug) === normalizeSalonValue(value))
  if (candidates.length > 1) throw new Error("Identifiant de salon ambigu")
  const salon = candidates[0]

  if (!salon?.id) {
    return null
  }

  // Salon membership is defined by its ID. Shared names or slugs do not
  // establish that two database records are the same location.
  return { salon, salonIds: [salon.id] }
}
