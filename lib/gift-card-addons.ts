import { z } from "zod"

// Physical extras sold with an online gift card: a printed card in a box, a
// candle, a gift set… The salons define them in Administration › Cartes
// cadeaux › Cadeaux physiques (name, picture, price, delivery fee, extra
// questions); the gift page offers them right before payment, on gift cards
// only. A chosen extra becomes an order the salons prepare and ship.

export const ADDON_ORDER_STATUSES = ["a_preparer", "expedie", "livre", "annule"] as const
export type AddonOrderStatus = (typeof ADDON_ORDER_STATUSES)[number]
export const ADDON_ORDER_STATUS_LABELS: Record<AddonOrderStatus, string> = {
  a_preparer: "À préparer",
  expedie: "Expédié",
  livre: "Livré",
  annule: "Annulé",
}

export const MAX_ADDON_QUANTITY = 10

const ExtraFieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  required: z.boolean().default(false),
})

export const GiftCardAddonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  price_cents: z.coerce.number().int().min(0),
  delivery_fee_cents: z.coerce.number().int().min(0).default(0),
  /** False for something handed over at the salon: no address is asked. */
  requires_shipping: z.boolean().default(true),
  /** Questions the buyer answers when choosing this extra ("Couleur du ruban"…). */
  extra_fields: z.array(ExtraFieldSchema).max(6).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
})

export type GiftCardAddonInput = z.infer<typeof GiftCardAddonSchema>
export type GiftCardAddonExtraField = z.infer<typeof ExtraFieldSchema>

export const ShippingAddressSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  postal_code: z.string().trim().min(4).max(12),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(2).max(60).default("France"),
})

export type ShippingAddress = z.infer<typeof ShippingAddressSchema>

/** What the gift page sends when the buyer picks a physical extra. */
export const AddonSelectionSchema = z.object({
  addon_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_ADDON_QUANTITY).default(1),
  shipping: ShippingAddressSchema.optional(),
  extra_answers: z.record(z.string().trim().max(200)).default({}),
})

export type AddonSelection = z.infer<typeof AddonSelectionSchema>

export interface PricedAddon {
  price_cents: number
  delivery_fee_cents: number
  requires_shipping: boolean
  extra_fields?: GiftCardAddonExtraField[] | null
}

/**
 * Checks a selection against the addon it names: an address when the extra is
 * shipped, an answer to every required question. Throws a message for the buyer.
 */
export function validateAddonSelection(addon: PricedAddon, selection: AddonSelection) {
  if (addon.requires_shipping && !selection.shipping) {
    throw new Error("Indiquez l'adresse de livraison du cadeau physique.")
  }
  for (const field of addon.extra_fields || []) {
    if (field.required && !(selection.extra_answers[field.label] || "").trim()) {
      throw new Error(`Précisez « ${field.label} » pour ce cadeau physique.`)
    }
  }
}

/** Card + extra × quantity + one delivery fee per order, all in cents. */
export function priceGiftCardOrder(servicePriceCents: number, addon?: PricedAddon | null, quantity = 1) {
  const service_cents = Math.max(0, Math.round(servicePriceCents))
  const addon_cents = addon ? Math.max(0, Math.round(addon.price_cents)) * Math.max(1, quantity) : 0
  const delivery_cents = addon && addon.requires_shipping ? Math.max(0, Math.round(addon.delivery_fee_cents)) : 0
  return { service_cents, addon_cents, delivery_cents, total_cents: service_cents + addon_cents + delivery_cents }
}

/** Stripe Checkout line items for a gift card, with the extra and its delivery as separate lines. */
export function buildGiftCardLineItems(
  service: { name: string; duration_minutes: number; price_cents: number },
  addon?: (PricedAddon & { name: string }) | null,
  quantity = 1
) {
  const priced = priceGiftCardOrder(service.price_cents, addon, quantity)
  const items: { quantity: number; price_data: { currency: "eur"; unit_amount: number; product_data: { name: string; description?: string } } }[] = [
    { quantity: 1, price_data: { currency: "eur", unit_amount: priced.service_cents, product_data: { name: `Carte cadeau — ${service.name}`, description: `${service.duration_minutes} min` } } },
  ]
  if (addon) {
    items.push({ quantity: Math.max(1, quantity), price_data: { currency: "eur", unit_amount: Math.max(0, Math.round(addon.price_cents)), product_data: { name: `Cadeau physique — ${addon.name}` } } })
    if (priced.delivery_cents > 0) {
      items.push({ quantity: 1, price_data: { currency: "eur", unit_amount: priced.delivery_cents, product_data: { name: "Frais de livraison" } } })
    }
  }
  // Stripe refuses a zero-amount line; a free card or extra is still listed, as a 0 € item is allowed only when another line pays.
  return items.filter((item) => item.price_data.unit_amount > 0 || items.length === 1)
}

export function formatEuros(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}
