import { ImageResponse } from "next/og"
import { formatGiftCardCode, getBaseUrl } from "@/lib/gift-cards"

type GiftCardAttachmentInput = {
  serviceName: string
  code: string
  recipientName?: string | null
  personalMessage?: string | null
}

const CARD_WIDTH = 1400
const CARD_HEIGHT = 900

function normalizeLines(value?: string | null, maxLineLength = 42, maxLines = 4) {
  if (!value) return []

  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (nextLine.length <= maxLineLength) {
      currentLine = nextLine
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }
    currentLine = word

    if (lines.length >= maxLines - 1) {
      break
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine)
  }

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxLineLength - 1)).trimEnd()}…`
  }

  return lines
}

function giftCardFileName(code: string) {
  return `carte-cadeau-les-temples-${formatGiftCardCode(code).toLowerCase()}.png`
}

export async function generateGiftCardAttachment(input: GiftCardAttachmentInput) {
  const formattedCode = formatGiftCardCode(input.code)
  const redeemUrl = `${getBaseUrl()}/jai-une-carte-cadeau`
  const messageLines = normalizeLines(input.personalMessage)

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #1f160f 0%, #352117 40%, #8b6737 100%)",
          color: "#f8f1e7",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 620,
            height: 620,
            borderRadius: "9999px",
            background: "rgba(255, 216, 145, 0.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            left: -180,
            width: 560,
            height: 560,
            borderRadius: "9999px",
            background: "rgba(176, 125, 57, 0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 28,
            borderRadius: 36,
            border: "1px solid rgba(245, 212, 152, 0.28)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "72px 76px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: 24,
                  letterSpacing: 8,
                  textTransform: "uppercase",
                  color: "#d9bc8d",
                }}
              >
                Les Temples
              </span>
              <span
                style={{
                  marginTop: 20,
                  fontSize: 28,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  color: "rgba(248, 241, 231, 0.72)",
                }}
              >
                Carte Cadeau
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: "rgba(248, 241, 231, 0.56)",
                }}
              >
                Expérience bien-être
              </span>
              <div
                style={{
                  display: "flex",
                  padding: "14px 20px",
                  borderRadius: 999,
                  background: "rgba(248, 241, 231, 0.1)",
                  border: "1px solid rgba(248, 241, 231, 0.18)",
                  fontSize: 20,
                  color: "#f5d498",
                }}
              >
                {input.recipientName ? `Pour ${input.recipientName}` : "À offrir"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 850 }}>
            <span
              style={{
                fontSize: 22,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(248, 241, 231, 0.62)",
              }}
            >
              Prestation offerte
            </span>
            <h1
              style={{
                display: "flex",
                margin: "18px 0 0",
                fontSize: 76,
                lineHeight: 1.08,
                fontWeight: 700,
                color: "#fff8ef",
              }}
            >
              {input.serviceName}
            </h1>

            <div
              style={{
                display: "flex",
                marginTop: 40,
                padding: "22px 26px",
                borderRadius: 28,
                background: "rgba(17, 11, 8, 0.34)",
                border: "1px solid rgba(245, 212, 152, 0.16)",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: "rgba(248, 241, 231, 0.52)",
                }}
              >
                Code cadeau
              </span>
              <span
                style={{
                  display: "flex",
                  marginTop: 10,
                  fontSize: 52,
                  letterSpacing: 8,
                  color: "#f5d498",
                  fontWeight: 700,
                }}
              >
                {formattedCode}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 28, alignItems: "flex-end" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                maxWidth: 760,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: "rgba(248, 241, 231, 0.52)",
                }}
              >
                Utilisation
              </span>
              <span style={{ display: "flex", fontSize: 28, lineHeight: 1.4, color: "#f7efe5" }}>
                Réservez avec ce code sur {redeemUrl.replace(/^https?:\/\//, "")}
              </span>
              {messageLines.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginTop: 12,
                    padding: "18px 22px",
                    borderRadius: 24,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff8ef",
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "rgba(248, 241, 231, 0.56)",
                    }}
                  >
                    Message
                  </span>
                  {messageLines.map((line, index) => (
                    <span key={`${line}-${index}`} style={{ display: "flex", marginTop: index === 0 ? 10 : 6, fontSize: 24, lineHeight: 1.35 }}>
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 10,
                minWidth: 250,
              }}
            >
              <span style={{ display: "flex", fontSize: 20, color: "rgba(248, 241, 231, 0.65)" }}>
                Présentez ce code lors de la réservation
              </span>
              <span style={{ display: "flex", fontSize: 18, color: "rgba(248, 241, 231, 0.42)" }}>
                Document généré automatiquement
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    }
  )

  const content = Buffer.from(await image.arrayBuffer())

  return {
    filename: giftCardFileName(input.code),
    content,
    contentType: "image/png",
    contentId: "gift-card-preview",
  }
}
