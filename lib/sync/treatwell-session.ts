import { open } from "@/lib/sync/secret-box"
import type { TreatwellSession } from "@/lib/sync/treatwell"

// Treatwell Connect has no password login the server can perform (Cloudflare
// Turnstile), so a session always starts in a browser. The back office accepts
// what that browser produced, in whichever form is at hand:
//   - the encrypted file written by `npm run sync:login -- treatwell`
//     (.sync/treatwell-session.enc, "v1:…");
//   - the session JSON itself ({ cookies: [...] });
//   - the `Cookie:` request header copied from the browser's network panel
//     ("ATKT=…; ITKT=…; extranet.currentVenueId=…");
//   - a request copied as cURL from the network panel (bash or cmd variant);
//   - a HAR export of the network panel (JSON with log.entries).

const AUTH_COOKIES = /(ATKT|ITKT)$/
/** "Rester connecté" cookies last about three months; a header copy carries no expiry, so assume that. */
const HEADER_COOKIE_DAYS = 90

export function parseTreatwellSessionInput(raw: string, userAgent?: string): TreatwellSession {
  const text = raw.trim()
  if (!text) throw new Error("Collez la session Treatwell (commande cURL, en-tête Cookie, fichier .enc, HAR ou JSON)")

  if (text.startsWith("v1:")) return normalise(open<TreatwellSession>(text))

  if (/^curl[\s(^"']/i.test(text)) {
    const curl = fromCurl(text)
    if (!curl) throw new Error("La commande cURL collée ne contient pas d'en-tête Cookie : copiez une requête faite après la connexion (clic droit → Copier → Copier en tant que cURL)")
    return fromCookieHeader(curl.cookieHeader, curl.userAgent || userAgent)
  }

  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as { log?: { entries?: unknown[] } } & Partial<TreatwellSession>
    if (Array.isArray(parsed.log?.entries)) {
      const har = fromHar(parsed.log.entries)
      if (!har) throw new Error("Aucune requête vers connect.treatwell.fr avec des cookies de connexion dans ce fichier HAR : exportez-le depuis l'onglet Réseau après la connexion")
      return fromCookieHeader(har.cookieHeader, har.userAgent || userAgent)
    }
    return normalise(parsed as TreatwellSession)
  }

  return fromCookieHeader(text.replace(/^cookie:\s*/i, ""), userAgent)
}

function fromCookieHeader(header: string, userAgent?: string): TreatwellSession {
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

/** Cookie and User-Agent headers of a request copied as cURL (bash, cmd or PowerShell copy). */
function fromCurl(text: string): { cookieHeader: string; userAgent?: string } | null {
  const flat = text
    .replace(/\^\r?\n/g, " ") // cmd line continuations
    .replace(/\\\r?\n/g, " ") // bash line continuations
    .replace(/\^(["<>|&%^])/g, "$1") // cmd caret escapes
    .replace(/\\(["'])/g, "$1") // quoted quotes inside $'…' strings
  const header = (name: string) => new RegExp(`["'\`]${name}:\\s*([^"'\`]+)["'\`]`, "i").exec(flat)?.[1]?.trim()
  const cookieHeader = header("cookie") || /(?:^|\s)(?:-b|--cookie)\s+["']([^"']+)["']/.exec(flat)?.[1]?.trim()
  if (!cookieHeader) return null
  return { cookieHeader, userAgent: header("user-agent") }
}

/** The best Cookie header among a HAR's requests to Treatwell: one carrying the login cookies. */
function fromHar(entries: unknown[]): { cookieHeader: string; userAgent?: string } | null {
  for (const entry of entries as { request?: { url?: string; headers?: { name: string; value: string }[] } }[]) {
    const request = entry?.request
    if (!request?.url || !/treatwell/i.test(request.url) || !Array.isArray(request.headers)) continue
    const header = (name: string) => request.headers!.find((h) => h?.name?.toLowerCase() === name)?.value
    const cookieHeader = header("cookie")
    if (cookieHeader && /(ATKT|ITKT)=/.test(cookieHeader)) return { cookieHeader, userAgent: header("user-agent") }
  }
  return null
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
