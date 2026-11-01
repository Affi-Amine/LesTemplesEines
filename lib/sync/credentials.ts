import type { createAdminClient } from "@/lib/supabase/admin"
import { open, seal } from "@/lib/sync/secret-box"
import type { Platform } from "@/lib/sync/types"

type SupabaseClient = ReturnType<typeof createAdminClient>

export interface PlatformCredentials {
  username: string
  password: string
}

const ENV_KEYS: Record<Platform, { username: string; password: string }> = {
  planity: { username: "PLANITY_USERNAME", password: "PLANITY_PASSWORD" },
  treatwell: { username: "TREATWELL_USERNAME", password: "TREATWELL_PASSWORD" },
}

/** Where the login the sync will use comes from. */
export type CredentialsSource = "database" | "environment" | "none"

/**
 * Credentials typed in the back office win over the environment variables, so
 * a password change on the platform never needs a redeploy.
 */
export async function loadCredentials(
  supabase: SupabaseClient,
  platform: Platform
): Promise<{ credentials: PlatformCredentials | null; source: CredentialsSource; updatedAt: string | null }> {
  const { data, error } = await supabase.from("platform_credentials").select("payload, updated_at").eq("platform", platform).maybeSingle()
  // A missing table (migration not applied) must not take the sync down: fall back to the environment.
  if (!error && data) {
    try {
      const credentials = open<PlatformCredentials>(data.payload)
      if (credentials?.username && credentials?.password) return { credentials, source: "database", updatedAt: data.updated_at }
    } catch {
      // Secret rotated: the row is unreadable, behave as if it did not exist.
    }
  }
  const keys = ENV_KEYS[platform]
  const username = process.env[keys.username]
  const password = process.env[keys.password]
  if (username && password) return { credentials: { username, password }, source: "environment", updatedAt: null }
  return { credentials: null, source: "none", updatedAt: null }
}

export async function saveCredentials(supabase: SupabaseClient, platform: Platform, credentials: PlatformCredentials) {
  const { error } = await supabase
    .from("platform_credentials")
    .upsert({ platform, payload: seal(credentials), updated_at: new Date().toISOString() })
  if (error) throw new Error(`platform_credentials: ${error.message} (migration 2026-11-01_platform_sync_admin.sql appliquée ?)`)
}

export async function clearCredentials(supabase: SupabaseClient, platform: Platform) {
  const { error } = await supabase.from("platform_credentials").delete().eq("platform", platform)
  if (error) throw new Error(`platform_credentials: ${error.message}`)
}
