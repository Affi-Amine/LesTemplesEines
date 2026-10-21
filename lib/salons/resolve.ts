export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SalonIdentity {
  id: string
  slug?: string | null
  name?: string | null
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
    .select("id, slug, name")

  targetQuery = isUUID(value) ? targetQuery.eq("id", value) : targetQuery.eq("slug", value)

  const { data: matches, error } = await targetQuery.limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const salon = Array.isArray(matches) ? matches[0] : matches

  if (!salon?.id) {
    return null
  }

  // Salon membership is defined by its ID. Shared names or slugs do not
  // establish that two database records are the same location.
  return { salon, salonIds: [salon.id] }
}
