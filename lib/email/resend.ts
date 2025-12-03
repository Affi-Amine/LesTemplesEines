import { Resend } from "resend"

const apiKey = process.env.RESEND_API_KEY

export const EMAIL_FROM = process.env.EMAIL_FROM || "Notifications <onboarding@resend.dev>"
export const isEmailEnabled = Boolean(apiKey)

const client = apiKey ? new Resend(apiKey) : null

export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  from?: string
}) {
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to:", params.to)
    return { skipped: true }
  }

  try {
    const result = await client.emails.send({
      from: params.from || EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    if ((result as any)?.error) {
      const err = (result as any).error
      console.error("[email] Resend send error:", err)
      throw new Error(err?.message || "Resend send failed")
    }
    const id = (result as any)?.data?.id
    if (id) {
      console.log("[email] Resend message id:", id)
    }
    return result
  } catch (error) {
    console.error("[email] Failed to send email:", error)
    throw error
  }
}
