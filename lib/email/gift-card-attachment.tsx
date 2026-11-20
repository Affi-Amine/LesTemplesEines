import { ImageResponse } from "next/og"
import { formatGiftCardCode, getBaseUrl } from "@/lib/gift-cards"
import { DEFAULT_GIFT_CARD_DESIGN, GIFT_CARD_THEMES, giftCardValidityLabel, type GiftCardDesign } from "@/lib/gift-card-design"
import { LOGO_LES_TEMPLES_DATA_URI } from "@/lib/email/assets/logo-les-temples"
import { loadGiftCardFonts } from "@/lib/email/gift-card-fonts"

// The gift card as a picture: attached to the buyer's and recipient's emails,
// shown inline in them, downloadable from the back office, and previewed live
// in the design generator. Layout rules are satori's (next/og): every box with
// several children is a flex box, and text sits alone in its element.

export type GiftCardImageInput = {
  buyerName: string
  serviceName: string
  code: string
  recipientName?: string | null
  personalMessage?: string | null
  /** Drives the validity line; today when absent (previews). */
  purchasedAt?: string | Date | null
}

export const CARD_WIDTH = 1400
export const CARD_HEIGHT = 900

/** Greedy word wrap into at most `maxLines`; what does not fit ends the last line with an ellipsis. */
export function normalizeLines(value?: string | null, maxLineLength = 42, maxLines = 4) {
  if (!value) return []
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ""
  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (nextLine.length <= maxLineLength) {
      currentLine = nextLine
      continue
    }
    if (currentLine) lines.push(currentLine)
    currentLine = word
  }
  if (currentLine) lines.push(currentLine)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(0, maxLineLength - 1)).trimEnd()}…`
    return kept
  }
  return lines
}

export function giftCardFileName(code: string) {
  return `carte-cadeau-les-temples-${formatGiftCardCode(code).toLowerCase()}.png`
}

const label = (color: string, size = 15) => ({
  display: "flex" as const,
  fontSize: size,
  letterSpacing: 4,
  textTransform: "uppercase" as const,
  color,
})

/** Renders the card and returns the PNG bytes. */
export async function renderGiftCardImage(input: GiftCardImageInput, design: GiftCardDesign = DEFAULT_GIFT_CARD_DESIGN) {
  const theme = GIFT_CARD_THEMES[design.theme] || GIFT_CARD_THEMES["or-sombre"]
  const fonts = await loadGiftCardFonts()
  const fontFamily = fonts.length ? "Cormorant" : undefined
  const dark = design.theme !== "ivoire"
  const formattedCode = formatGiftCardCode(input.code)
  const redeemHost = getBaseUrl().replace(/^https?:\/\//, "")
  const serviceLines = normalizeLines(input.serviceName, 34, 2)
  const messageLines = normalizeLines(input.personalMessage, 52, 3)
  const buyer = normalizeLines(input.buyerName, 26, 1)[0] || "—"
  const recipient = normalizeLines(input.recipientName || "La personne de votre choix", 26, 1)[0]
  const validity = giftCardValidityLabel(design, input.purchasedAt ? new Date(input.purchasedAt) : new Date())
  const [c0, c1, c2] = theme.background
  const codeBackground = dark ? "rgba(10, 6, 4, 0.42)" : "rgba(255, 255, 255, 0.7)"
  const overlay = dark ? "rgba(18, 11, 7, 0.66)" : "rgba(251, 246, 238, 0.82)"

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(120deg, ${c0} 0%, ${c1} 55%, ${c2} 100%)`,
          color: theme.ink,
          fontFamily,
        }}
      >
        {design.background_image_url && (
          <img
            src={design.background_image_url}
            alt=""
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            style={{ position: "absolute", top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT, objectFit: "cover" }}
          />
        )}
        {design.background_image_url && (
          <div style={{ position: "absolute", top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT, background: overlay }} />
        )}
        <div style={{ position: "absolute", top: -260, right: -200, width: 700, height: 700, borderRadius: 9999, background: dark ? "rgba(255, 216, 145, 0.10)" : "rgba(156, 122, 60, 0.10)" }} />
        <div style={{ position: "absolute", bottom: -300, left: -220, width: 620, height: 620, borderRadius: 9999, background: dark ? "rgba(176, 125, 57, 0.14)" : "rgba(156, 122, 60, 0.08)" }} />
        <div style={{ position: "absolute", top: 26, left: 26, right: 26, bottom: 26, borderRadius: 30, border: `1.5px solid ${theme.frame}` }} />
        <div style={{ position: "absolute", top: 38, left: 38, right: 38, bottom: 38, borderRadius: 22, border: `1px solid ${theme.panelBorder}` }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "64px 76px 56px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
              {design.show_logo && <img src={LOGO_LES_TEMPLES_DATA_URI} alt="" width={102} height={175} style={{ width: 102, height: 175 }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={label(theme.accent, 20)}>Les Temples</span>
                <span style={label(theme.muted, 13)}>Thaïlande · Massages & bien-être</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <span style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1, color: theme.accent }}>{design.title}</span>
              {design.tagline && <span style={{ display: "flex", fontSize: 25, color: theme.muted, fontStyle: "italic" }}>{design.tagline}</span>}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 40, alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 22 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={label(theme.muted, 16)}>Prestation offerte</span>
                {serviceLines.map((line, index) => (
                  <span key={`service-${index}`} style={{ display: "flex", fontSize: serviceLines.length > 1 ? 50 : 60, lineHeight: 1.08, fontWeight: 700, color: theme.ink }}>{line}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px 20px", borderRadius: 20, background: theme.panel, border: `1px solid ${theme.panelBorder}` }}>
                  <span style={label(theme.muted, 12)}>Offert par</span>
                  <span style={{ display: "flex", marginTop: 8, fontSize: 28, fontWeight: 500, color: theme.ink }}>{buyer}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px 20px", borderRadius: 20, background: theme.panel, border: `1px solid ${theme.panelBorder}` }}>
                  <span style={label(theme.muted, 12)}>Pour</span>
                  <span style={{ display: "flex", marginTop: 8, fontSize: 28, fontWeight: 500, color: theme.accent }}>{recipient}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: 470, gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", padding: "22px 26px", borderRadius: 24, background: codeBackground, border: `1.5px solid ${theme.frame}` }}>
                <span style={label(theme.muted, 15)}>Code cadeau</span>
                <span style={{ display: "flex", marginTop: 10, fontSize: 38, letterSpacing: 4, fontWeight: 700, whiteSpace: "nowrap", color: theme.accent }}>{formattedCode}</span>
              </div>
              {messageLines.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", padding: "16px 22px", borderRadius: 20, background: theme.panel, border: `1px solid ${theme.panelBorder}` }}>
                  <span style={label(theme.muted, 12)}>Le mot de {buyer}</span>
                  {messageLines.map((line, index) => (
                    <span key={`message-${index}`} style={{ display: "flex", marginTop: index === 0 ? 8 : 4, fontSize: 22, lineHeight: 1.3, fontStyle: "italic", color: theme.ink }}>{line}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 30, borderTop: `1px solid ${theme.panelBorder}`, paddingTop: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 820 }}>
              <span style={{ display: "flex", fontSize: 24, color: theme.ink }}>{validity}</span>
              {design.footer_note && <span style={{ display: "flex", fontSize: 20, color: theme.muted }}>{design.footer_note}</span>}
              <span style={{ display: "flex", fontSize: 20, color: theme.muted }}>Réservation en ligne : {redeemHost}/jai-une-carte-cadeau</span>
            </div>
            {design.signature && <span style={{ display: "flex", fontSize: 30, fontStyle: "italic", color: theme.accent }}>{design.signature}</span>}
          </div>
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: fonts.length ? fonts : undefined }
  )

  return Buffer.from(await image.arrayBuffer())
}

export async function generateGiftCardAttachment(input: GiftCardImageInput, design?: GiftCardDesign) {
  return {
    filename: giftCardFileName(input.code),
    content: await renderGiftCardImage(input, design),
    contentType: "image/png",
    contentId: "gift-card-preview",
  }
}
