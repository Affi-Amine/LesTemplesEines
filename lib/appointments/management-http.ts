import { NextResponse, type NextRequest } from "next/server"
import { ManagementError } from "./management"

export function managementJSON(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
  } })
}

export async function managementBody(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("x-booking-action") !== "1" ||
    !request.headers.get("content-type")?.startsWith("application/json")) throw new ManagementError("Demande non autorisée.", 403)
  const text = await request.text()
  if (text.length > 2048) throw new ManagementError("Demande trop volumineuse.", 413)
  try { return JSON.parse(text) } catch { throw new ManagementError("Demande invalide.") }
}

// A bounded, best-effort per-instance limiter. Access still requires a 256-bit
// secret on every request; the limiter is not an authorization mechanism.
const windows = new Map<string, { count: number; until: number }>()
export function limitManagementRequests(key: string, maximum = 60) {
  const now = Date.now(), current = windows.get(key)
  if (!current || current.until <= now) {
    if (windows.size >= 2048) windows.delete(windows.keys().next().value!)
    windows.set(key, { count: 1, until: now + 60_000 }); return
  }
  if (++current.count > maximum) throw new ManagementError("Trop de demandes. Réessayez dans une minute.", 429)
}

export function managementFailure(error: unknown) {
  if (error instanceof ManagementError) return managementJSON({ error: error.message }, error.status)
  if (error && typeof error === "object" && "issues" in error) return managementJSON({ error: "Vérifiez les informations transmises." }, 400)
  console.error("[booking-management] Request failed", error && typeof error === "object" && "code" in error ? error.code : "unknown")
  return managementJSON({ error: "Impossible de traiter votre demande. Réessayez ou contactez le salon." }, 500)
}
