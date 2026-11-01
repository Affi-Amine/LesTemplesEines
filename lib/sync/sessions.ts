import type { createAdminClient } from "@/lib/supabase/admin"
import { open, seal } from "@/lib/sync/secret-box"
import type { Platform } from "@/lib/sync/types"

type SupabaseClient = ReturnType<typeof createAdminClient>

export async function loadSession<T>(supabase: SupabaseClient, platform: Platform): Promise<T | null> {
  const { data, error } = await supabase.from("platform_sessions").select("payload").eq("platform", platform).maybeSingle()
  if (error) throw new Error(`platform_sessions: ${error.message}`)
  if (!data) return null
  try {
    return open<T>(data.payload)
  } catch {
    // Secret rotated or row corrupted: behave as if logged out.
    return null
  }
}

export async function saveSession(supabase: SupabaseClient, platform: Platform, value: unknown) {
  const { error } = await supabase
    .from("platform_sessions")
    .upsert({ platform, payload: seal(value), updated_at: new Date().toISOString() })
  if (error) throw new Error(`platform_sessions: ${error.message}`)
}

export async function clearSession(supabase: SupabaseClient, platform: Platform) {
  await supabase.from("platform_sessions").delete().eq("platform", platform)
}
