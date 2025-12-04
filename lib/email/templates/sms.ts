// sms.ts
const SMS_API_URL = process.env.SMS_API_URL || "https://sms-send-ixnv.onrender.com/sms"
const SMS_API_KEY = process.env.SMS_API_KEY || "SECRET123"

export const isSmsEnabled = Boolean(SMS_API_KEY)

type SendSmsParams = {
    to: string
    message: string
}

export async function sendSms({ to, message }: SendSmsParams) {
    if (!isSmsEnabled) {
        console.warn("[sms] SMS_API_KEY not set — skipping SMS to:", to)
        return { skipped: true }
    }

    try {
        const res = await fetch(SMS_API_URL, {
            method: "POST",
            headers: {
                "accept": "application/json",
                "Content-Type": "application/json",
                "x-api-key": SMS_API_KEY,
            },
            body: JSON.stringify({ to, message }),
        })

        if (!res.ok) {
            const text = await res.text()
            console.error("[sms] Failed to send SMS:", res.status, text)
            throw new Error(`SMS send failed with status ${res.status}`)
        }

        const data = await res.json()
        console.log("[sms] SMS queued:", data)
        return data
    } catch (error) {
        console.error("[sms] Error while sending SMS:", error)
        throw error
    }
}
