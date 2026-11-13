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

// Promotional prestations (category "OFFRE Spéciale": the 45 € and 49 €
// opening offers, the 90 € duo) are sold at a reduced price for a limited
// time. Bought as a gift card they would be redeemed long after the offer
// ends, at a price the salons no longer practise, so the salons asked for them
// to be taken off the gift page (13/11/2026). Gift cards already sold on them
// stay valid: only new purchases are refused.
const PROMOTIONAL_SERVICE_CATEGORY = "offre speciale"

export function isGiftCardEligible(service: { category?: string | null }) {
  const category = (service.category || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
  return category !== PROMOTIONAL_SERVICE_CATEGORY
}

export const GIFT_CARD_INELIGIBLE_MESSAGE =
  "Cette prestation est une offre spéciale à durée limitée : elle ne peut pas être offerte en carte cadeau."

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
