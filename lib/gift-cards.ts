import { randomBytes } from "crypto"

export function normalizeGiftCardCode(value: string) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function formatGiftCardCode(raw: string) {
  const normalized = normalizeGiftCardCode(raw)
  return normalized.match(/.{1,4}/g)?.join("-") || normalized
}

export function generateGiftCardCode() {
  return normalizeGiftCardCode(randomBytes(6).toString("hex").toUpperCase())
}

export function getBaseUrl(fallbackOrigin?: string) {
  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL

  const baseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    fallbackOrigin ||
    (vercelUrl ? `https://${vercelUrl}` : undefined) ||
    "http://localhost:3000"

  return baseUrl.replace(/\/+$/, "")
}
