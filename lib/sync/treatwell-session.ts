import { open } from "@/lib/sync/secret-box"
import type { TreatwellSession } from "@/lib/sync/treatwell"

// Treatwell Connect has no password login the server can perform (Cloudflare
// Turnstile), so a session always starts in a browser. The back office accepts
// what that browser produced, in whichever form is at hand:
//   - the encrypted file written by `npm run sync:login -- treatwell`
//     (.sync/treatwell-session.enc, "v1:…");
//   - the session JSON itself ({ cookies: [...] });
//   - the `Cookie:` request header copied from the browser's network panel
//     ("ATKT=…; ITKT=…; extranet.currentVenueId=…").

const AUTH_COOKIES = /(ATKT|ITKT)$/
/** "Rester connecté" cookies last about three months; a header copy carries no expiry, so assume that. */
const HEADER_COOKIE_DAYS = 90

export function parseTreatwellSessionInput(raw: string, userAgent?: string): TreatwellSession {
  const text = raw.trim()
  if (!text) throw new Error("Collez la session Treatwell (fichier .enc, JSON ou en-tête Cookie)")

  if (text.startsWith("v1:")) return normalise(open<TreatwellSession>(text))

  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as Partial<TreatwellSession>
    return normalise(parsed as TreatwellSession)
  }

  const header = text.replace(/^cookie:\s*/i, "")
  const expires = Date.now() / 1000 + HEADER_COOKIE_DAYS * 86_400
  const cookies = header
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf("=")
      if (index <= 0) throw new Error(`Cookie illisible : « ${pair.slice(0, 40)} »`)
      return { name: pair.slice(0, index).trim(), value: pair.slice(index + 1).trim(), domain: ".treatwell.fr", path: "/", expires }
    })
  return normalise({ cookies, userAgent, savedAt: new Date().toISOString() })
}

function normalise(session: TreatwellSession): TreatwellSession {
  const cookies = Array.isArray(session?.cookies) ? session.cookies.filter((c) => c && typeof c.name === "string" && typeof c.value === "string") : []
  if (!cookies.length) throw new Error("Aucun cookie dans la session fournie")
  if (!cookies.some((c) => AUTH_COOKIES.test(c.name))) {
    throw new Error("Les cookies de connexion Treatwell (ATKT / ITKT) sont absents : connectez-vous avec « Rester connecté » puis recopiez les cookies")
  }
  return {
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || ".treatwell.fr",
      path: c.path || "/",
      expires: typeof c.expires === "number" ? c.expires : -1,
    })),
    userAgent: session.userAgent,
    savedAt: session.savedAt || new Date().toISOString(),
  }
}

/** What the back office shows about a stored Treatwell session, without the cookie values. */
export function describeTreatwellSession(session: TreatwellSession | null) {
  if (!session?.cookies?.length) return { cookies: 0, expiresAt: null as string | null, expired: true, venueId: null as string | null }
  const now = Date.now() / 1000
  const auth = session.cookies.filter((c) => AUTH_COOKIES.test(c.name))
  const expiries = auth.map((c) => c.expires).filter((e) => e > 0)
  const earliest = expiries.length ? Math.min(...expiries) : null
  const venue = session.cookies.find((c) => c.name === "extranet.currentVenueId")?.value || null
  return {
    cookies: session.cookies.length,
    expiresAt: earliest ? new Date(earliest * 1000).toISOString() : null,
    expired: !auth.length || auth.every((c) => c.expires > 0 && c.expires <= now),
    venueId: venue ? decodeURIComponent(venue) : null,
  }
}
