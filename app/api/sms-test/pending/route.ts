export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { curlRequest } from "@/lib/net/curl"

function buildPendingUrl(): string {
  const url = process.env.SMS_API_URL || ""
  const base = url ? new URL(url).origin : ""
  return `${base}/sms/pending`
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  if (process.env.USE_CURL === "1") {
    return await curlRequest(
      url,
      { method: "GET", headers: { accept: "application/json", "x-api-key": process.env.SMS_API_KEY || "" } },
      timeoutMs,
    )
  }
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: "GET", headers: { accept: "application/json", "x-api-key": process.env.SMS_API_KEY || "" }, signal: controller.signal })
    const bodyText = await res.text().catch(() => "")
    return { status: res.status, bodyText }
  } finally {
    clearTimeout(id)
  }
}

export async function GET() {
  try {
    const url = buildPendingUrl()
    if (!url || !process.env.SMS_API_KEY) {
      return NextResponse.json({ error: "SMS env not configured" }, { status: 400 })
    }

    const timeout = Number(process.env.SMS_TIMEOUT_MS ?? 30000)
    const { status, bodyText } = await fetchWithTimeout(url, timeout)
    if (status < 200 || status >= 300) {
      return NextResponse.json({ ok: false, status, body: bodyText }, { status: 502 })
    }
    return NextResponse.json({ ok: true, body: bodyText })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unknown error" }, { status: 500 })
  }
}
