import { NextResponse } from "next/server"
import { curlRequest } from "@/lib/net/curl"

function buildMarkSentUrl(id: string): string {
  const url = process.env.SMS_API_URL || ""
  const base = url ? new URL(url).origin : ""
  return `${base}/sms/${encodeURIComponent(id)}/mark-sent`
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  return await curlRequest(
    url,
    {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "x-api-key": process.env.SMS_API_KEY || "",
      },
    },
    timeoutMs,
  )
}

export async function PATCH(_: Request, { params }: any) {
  try {
    const smsId = params.id
    if (!smsId) {
      return NextResponse.json({ error: "Missing sms id" }, { status: 400 })
    }
    if (!process.env.SMS_API_KEY || !process.env.SMS_API_URL) {
      return NextResponse.json({ error: "SMS env not configured" }, { status: 400 })
    }

    const url = buildMarkSentUrl(smsId)
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
