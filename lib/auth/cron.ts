import type { NextRequest } from "next/server"
import { timingSafeEqual } from "crypto"

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Also false when
 * CRON_SECRET is unset, so an unconfigured deployment can't have its jobs
 * triggered by anyone who guesses the path.
 */
export function isCronAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization") || ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : ""

  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
