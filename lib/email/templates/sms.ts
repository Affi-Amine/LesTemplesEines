import { curlRequest } from "@/lib/net/curl"
// sms.ts
const SMS_API_URL = process.env.SMS_API_URL
const SMS_API_KEY = process.env.SMS_API_KEY
const SMS_FALLBACK_URL = process.env.SMS_FALLBACK_URL
const SMS_FALLBACK_API_KEY = process.env.SMS_FALLBACK_API_KEY

const SMS_RETRIES = Number(process.env.SMS_RETRIES ?? 3)
const SMS_TIMEOUT_MS = Number(process.env.SMS_TIMEOUT_MS ?? 10000)
const SMS_BACKOFF_MS = Number(process.env.SMS_BACKOFF_MS ?? 1500)

export const isSmsEnabled = Boolean(
  (SMS_API_KEY && SMS_API_URL) || (SMS_FALLBACK_API_KEY && SMS_FALLBACK_URL),
)

type SendSmsParams = {
  to: string
  message: string
}

function normalizePhoneNumber(raw: string): string {
  const to = (raw || "").trim().replace(/[\s\u00A0\-\.]/g, "")
  if (!to) return to
  if (to.startsWith("+")) return to
  // Simple FR heuristics: convert leading 0XXXXXXXXX to +33XXXXXXXXX
  if (/^0\d{9}$/.test(to)) return "+33" + to.slice(1)
  // If already starts with country code without plus
  if (/^\d{10,}$/.test(to) && to.startsWith("33")) return "+" + to
  // If just 9 or 10 digits, assume FR mobile
  if (/^\d{9,10}$/.test(to)) return "+33" + (to.length === 10 ? to.slice(1) : to)
  return to
}

async function fetchJson(url: string, body: any, headers: Record<string, string>) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { accept: "application/json", "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text().catch(() => "")
    if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`)
    try {
      return JSON.parse(text || "{}")
    } catch {
      return {}
    }
  } finally {
    clearTimeout(id)
  }
}

async function postWithRetry(url: string, body: any, headers: Record<string, string>) {
  let lastErr: any = null
  for (let attempt = 1; attempt <= SMS_RETRIES; attempt++) {
    try {
      const useCurl = process.env.USE_CURL === "1"
      if (!useCurl) {
        return await fetchJson(url, body, headers)
      }
      const { status, bodyText } = await curlRequest(url, { method: "POST", headers: { accept: "application/json", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }, SMS_TIMEOUT_MS)
      if (status < 200 || status >= 300) throw new Error(`HTTP ${status} ${bodyText || ""}`)
      try { return JSON.parse(bodyText || "{}") } catch { return {} }
    } catch (err) {
      lastErr = err
      const isLast = attempt === SMS_RETRIES
      console.warn(`[sms] Attempt ${attempt} failed:`, err)
      if (isLast) break
      await new Promise((r) => setTimeout(r, SMS_BACKOFF_MS * attempt))
    }
  }
  throw lastErr
}

export async function sendSms({ to, message }: SendSmsParams) {
  if (!isSmsEnabled) {
    console.warn("[sms] SMS disabled — missing SMS_API_URL or SMS_API_KEY")
    return { skipped: true }
  }

  const normalizedTo = normalizePhoneNumber(to)
  if (!normalizedTo) {
    console.warn("[sms] Invalid phone number provided:", to)
    return { skipped: true, reason: "invalid_phone" }
  }

  try {
    let lastErr: any = null
    // Try primary provider first (if configured)
    if (SMS_API_URL && SMS_API_KEY) {
      try {
        const data = await postWithRetry(
          SMS_API_URL as string,
          { to: normalizedTo, message },
          { "x-api-key": SMS_API_KEY as string },
        )
        console.log("[sms] SMS queued via primary:", data)
        return data
      } catch (err) {
        lastErr = err
        console.warn("[sms] Primary provider failed:", err)
      }
    }

    // Try fallback provider if available
    if (SMS_FALLBACK_URL && SMS_FALLBACK_API_KEY) {
      try {
        const data = await postWithRetry(
          SMS_FALLBACK_URL as string,
          { to: normalizedTo, message },
          { "x-api-key": SMS_FALLBACK_API_KEY as string },
        )
        console.log("[sms] SMS queued via fallback:", data)
        return data
      } catch (err) {
        lastErr = err
        console.error("[sms] Fallback provider failed:", err)
      }
    }

    // If we get here, both providers failed or none were configured properly
    throw lastErr ?? new Error("SMS send failed: no provider reachable")
  } catch (error) {
    console.error("[sms] Error while sending SMS:", error)
    throw error
  }
}
