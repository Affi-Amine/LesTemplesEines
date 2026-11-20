// Serif typefaces for the gift card PNG. next/og only ships a sans-serif, so
// the card fetches Cormorant Garamond from Google Fonts once per process and
// keeps it in memory. Any failure (offline build, blocked egress, slow DNS)
// falls back to the built-in font: a plainer card still beats no card.

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" }

const FONT_FAMILY = "Cormorant Garamond"
const WEIGHTS: Array<400 | 500 | 600 | 700> = [500, 700]
const TIMEOUT_MS = 4000

let cached: Promise<OgFont[]> | null = null

async function fetchWeight(weight: number): Promise<OgFont | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(FONT_FAMILY)}:wght@${weight}&display=swap`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).then((response) => (response.ok ? response.text() : ""))
    const url = css.match(/url\(([^)]+\.ttf)\)/)?.[1]
    if (!url) return null
    const data = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then((response) => (response.ok ? response.arrayBuffer() : null))
    return data ? { name: "Cormorant", data, weight: weight as OgFont["weight"], style: "normal" } : null
  } catch {
    return null
  }
}

export function loadGiftCardFonts(): Promise<OgFont[]> {
  if (!cached) {
    cached = Promise.all(WEIGHTS.map(fetchWeight)).then((fonts) => {
      const loaded = fonts.filter((font): font is OgFont => Boolean(font))
      if (!loaded.length) cached = null // retry next time rather than caching a failure
      return loaded
    })
  }
  return cached
}
