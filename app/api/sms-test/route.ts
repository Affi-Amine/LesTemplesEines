export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { sendSms } from "@/lib/email/templates/sms"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const to = body?.to as string | undefined
    const message = body?.message as string | undefined

    if (!to || !message) {
      return NextResponse.json(
        { error: "Missing 'to' or 'message' in request body" },
        { status: 400 },
      )
    }

    const result = await sendSms({ to, message })
    return NextResponse.json({ ok: true, result })
  } catch (error: any) {
    const msg = error?.message || "Unknown error"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
