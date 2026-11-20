import { z } from "zod"

// The look of the gift card PNG sent with the emails and downloadable from the
// back office. The salons adjust it from Administration › Cartes cadeaux ›
// Générateur; one row in gift_card_design_settings holds the choices, and
// everything falls back to these defaults when the row (or the table) is missing.

export const GIFT_CARD_THEMES = {
  "or-sombre": {
    label: "Or sombre",
    background: ["#1a120c", "#33211a", "#7a5a30"],
    ink: "#f8f1e7",
    accent: "#e2bf7c",
    muted: "rgba(248, 241, 231, 0.62)",
    panel: "rgba(255, 248, 236, 0.07)",
    panelBorder: "rgba(226, 191, 124, 0.32)",
    frame: "rgba(226, 191, 124, 0.55)",
  },
  ivoire: {
    label: "Ivoire",
    background: ["#fbf6ee", "#f3e9d8", "#e6d3b3"],
    ink: "#2b1d12",
    accent: "#9c7a3c",
    muted: "rgba(43, 29, 18, 0.62)",
    panel: "rgba(255, 255, 255, 0.55)",
    panelBorder: "rgba(156, 122, 60, 0.35)",
    frame: "rgba(156, 122, 60, 0.6)",
  },
  jade: {
    label: "Jade",
    background: ["#0f2420", "#19403a", "#3f7a67"],
    ink: "#f1f7f2",
    accent: "#e7cd8f",
    muted: "rgba(241, 247, 242, 0.62)",
    panel: "rgba(255, 255, 255, 0.07)",
    panelBorder: "rgba(231, 205, 143, 0.32)",
    frame: "rgba(231, 205, 143, 0.55)",
  },
} as const

export type GiftCardThemeKey = keyof typeof GIFT_CARD_THEMES
export const GIFT_CARD_THEME_KEYS = Object.keys(GIFT_CARD_THEMES) as GiftCardThemeKey[]

export const GiftCardDesignSchema = z.object({
  theme: z.enum(["or-sombre", "ivoire", "jade"]),
  title: z.string().trim().min(1).max(40),
  tagline: z.string().trim().max(80),
  footer_note: z.string().trim().max(160),
  signature: z.string().trim().max(60),
  show_logo: z.boolean(),
  /** Months from purchase; null means the card does not expire. */
  validity_months: z.number().int().min(1).max(60).nullable(),
  background_image_url: z.string().url().nullable(),
})

export type GiftCardDesign = z.infer<typeof GiftCardDesignSchema>

export const DEFAULT_GIFT_CARD_DESIGN: GiftCardDesign = {
  theme: "or-sombre",
  title: "Carte Cadeau",
  tagline: "Un moment de bien-être à offrir",
  footer_note: "Présentez ce code lors de la réservation, en ligne ou au salon.",
  signature: "Les Temples Thaïlande",
  show_logo: true,
  validity_months: 12,
  background_image_url: null,
}

/** Settings row (or anything) → a complete design; unknown or invalid fields take the default. */
export function resolveGiftCardDesign(row: unknown): GiftCardDesign {
  const source = (row && typeof row === "object" ? row : {}) as Record<string, unknown>
  const merged: Record<string, unknown> = { ...DEFAULT_GIFT_CARD_DESIGN }
  for (const key of Object.keys(DEFAULT_GIFT_CARD_DESIGN) as (keyof GiftCardDesign)[]) {
    if (source[key] !== undefined && source[key] !== null) merged[key] = source[key]
    // These two are nullable on purpose: an explicit null is a choice, not a gap.
    if ((key === "validity_months" || key === "background_image_url") && source[key] === null) merged[key] = null
  }
  const parsed = GiftCardDesignSchema.safeParse(merged)
  if (parsed.success) return parsed.data
  // Keep every valid field, replace the rest one by one.
  const result: Record<string, unknown> = { ...DEFAULT_GIFT_CARD_DESIGN }
  for (const key of Object.keys(DEFAULT_GIFT_CARD_DESIGN) as (keyof GiftCardDesign)[]) {
    const single = GiftCardDesignSchema.shape[key].safeParse(merged[key])
    if (single.success) result[key] = single.data
  }
  return result as GiftCardDesign
}

export function giftCardValidityLabel(design: Pick<GiftCardDesign, "validity_months">, purchasedAt: Date = new Date()) {
  if (!design.validity_months) return "Valable sans limite de durée"
  const until = new Date(purchasedAt)
  until.setMonth(until.getMonth() + design.validity_months)
  return `Valable jusqu'au ${until.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" })}`
}
