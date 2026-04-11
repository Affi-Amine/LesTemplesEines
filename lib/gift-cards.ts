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

export function getBaseUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "")
}
