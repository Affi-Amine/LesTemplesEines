import { NextResponse } from "next/server"
import { httpRequest } from "@/lib/net/http"
import { spawnSync } from "child_process"

function checkCurlAvailable() {
  try {
    const res = spawnSync("curl", ["--version"], { encoding: "utf8", timeout: 3000 })
    if (res.error) return { ok: false, error: res.error.message }
    if (res.status !== 0) return { ok: false, status: res.status, stderr: res.stderr }
    return { ok: true, stdout: res.stdout }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

function getProviderOrigin(url?: string) {
  try {
    if (!url) return undefined
    const u = new URL(url)
    return u.origin
  } catch {
    return undefined
  }
}

export async function GET(req: Request) {
  const token = req.headers.get("x-debug-token") || ""
  if (process.env.NEXT_SMS_DEBUG_TOKEN && token !== process.env.NEXT_SMS_DEBUG_TOKEN) {
    return NextResponse.json({ error: "invalid debug token" }, { status: 401 })
  }

  const SMS_API_URL = process.env.SMS_API_URL
  const SMS_API_KEY = Boolean(process.env.SMS_API_KEY)
  const SMS_FALLBACK_URL = process.env.SMS_FALLBACK_URL
  const SMS_FALLBACK_API_KEY = Boolean(process.env.SMS_FALLBACK_API_KEY)

  const curl = checkCurlAvailable()
  const primaryOrigin = getProviderOrigin(SMS_API_URL)
  const fallbackOrigin = getProviderOrigin(SMS_FALLBACK_URL)

  const results: any = {
    env: {
      sms_api_url: SMS_API_URL ? true : false,
      sms_api_key: SMS_API_KEY,
      sms_fallback_url: SMS_FALLBACK_URL ? true : false,
      sms_fallback_api_key: SMS_FALLBACK_API_KEY,
    },
    curl,
    network: {},
  }

  // Try a lightweight HEAD/GET to provider origin to check connectivity
  async function tryOrigin(origin: string | undefined, keyName: string) {
    if (!origin) return { ok: false, reason: "no_url" }
    try {
      const url = origin
      const r = await httpRequest(url, { method: "GET", headers: {} }, 3000)
      return { ok: true, status: r.status }
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) }
    }
  }

  results.network.primary = await tryOrigin(primaryOrigin, "primary")
  results.network.fallback = await tryOrigin(fallbackOrigin, "fallback")

  return NextResponse.json(results)
}
