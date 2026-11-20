// Gift cards: the physical extras' pricing and validation, the card design
// settings and the card's text wrapping. Pure modules, no network.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  cache.set(file, exports)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(name) {
    if (name === "@/lib/supabase/admin") return {}
    if (name.startsWith("@/")) {
      const base = name.slice(2)
      return load(fs.existsSync(path.join(root, `${base}.tsx`)) ? `${base}.tsx` : `${base}.ts`)
    }
    return require(name)
  }, Buffer, Intl, Date, console, process, fetch, AbortSignal })
  return exports
}
const plain = (value) => JSON.parse(JSON.stringify(value))

const { priceGiftCardOrder, buildGiftCardLineItems, validateAddonSelection, AddonSelectionSchema } = load("lib/gift-card-addons.ts")
const { resolveGiftCardDesign, DEFAULT_GIFT_CARD_DESIGN, giftCardValidityLabel } = load("lib/gift-card-design.ts")
const { normalizeLines } = load("lib/email/gift-card-attachment.tsx")

// ---- physical extras: price ---------------------------------------------------

const service = { name: "Massage Thaï 1H", duration_minutes: 60, price_cents: 6500 }
const box = { name: "Coffret carte imprimée", price_cents: 1500, delivery_fee_cents: 590, requires_shipping: true, extra_fields: [{ label: "Couleur du ruban", required: true }] }
const pickup = { name: "Bougie", price_cents: 1200, delivery_fee_cents: 590, requires_shipping: false, extra_fields: [] }

assert.deepEqual(plain(priceGiftCardOrder(6500)), { service_cents: 6500, addon_cents: 0, delivery_cents: 0, total_cents: 6500 })
assert.deepEqual(plain(priceGiftCardOrder(6500, box, 2)), { service_cents: 6500, addon_cents: 3000, delivery_cents: 590, total_cents: 10090 })
assert.deepEqual(plain(priceGiftCardOrder(6500, pickup, 1)), { service_cents: 6500, addon_cents: 1200, delivery_cents: 0, total_cents: 7700 })
console.log("PASS: card + extra × quantity + one delivery fee, none when handed over at the salon")

let lines = plain(buildGiftCardLineItems(service, box, 2))
assert.equal(lines.length, 3)
assert.deepEqual(lines.map((line) => [line.quantity, line.price_data.unit_amount]), [[1, 6500], [2, 1500], [1, 590]])
assert.match(lines[0].price_data.product_data.name, /Carte cadeau — Massage Thaï 1H/)
assert.match(lines[2].price_data.product_data.name, /livraison/i)
lines = plain(buildGiftCardLineItems(service))
assert.equal(lines.length, 1)
lines = plain(buildGiftCardLineItems(service, { ...pickup, price_cents: 0 }, 1))
assert.equal(lines.length, 1, "a free extra adds no zero-amount Stripe line")
console.log("PASS: Stripe gets separate lines for the card, the extra and the delivery, never a zero line")

// ---- physical extras: what the buyer must provide -----------------------------

const selection = AddonSelectionSchema.parse({ addon_id: "00000000-0000-4000-8000-000000000001" })
assert.equal(selection.quantity, 1)
assert.deepEqual(plain(selection.extra_answers), {})
assert.throws(() => validateAddonSelection(box, selection), /adresse de livraison/)
const shipping = { name: "Léa Martin", phone: "0612345678", line1: "3 rue des Lilas", postal_code: "75011", city: "Paris", country: "France" }
assert.throws(() => validateAddonSelection(box, { ...selection, shipping }), /Couleur du ruban/)
validateAddonSelection(box, { ...selection, shipping, extra_answers: { "Couleur du ruban": "Or" } })
validateAddonSelection(pickup, selection)
assert.throws(() => AddonSelectionSchema.parse({ addon_id: "nope" }))
assert.throws(() => AddonSelectionSchema.parse({ addon_id: selection.addon_id, quantity: 11 }))
console.log("PASS: a shipped extra needs an address and its required answers; a salon pickup needs neither")

// ---- design settings -----------------------------------------------------------

assert.deepEqual(plain(resolveGiftCardDesign(null)), plain(DEFAULT_GIFT_CARD_DESIGN))
let design = resolveGiftCardDesign({ theme: "violet", title: "Bon Cadeau", validity_months: null, background_image_url: "not a url", show_logo: false })
assert.equal(design.theme, "or-sombre", "unknown theme falls back")
assert.equal(design.title, "Bon Cadeau", "valid fields are kept")
assert.equal(design.validity_months, null, "an explicit null validity means no expiry")
assert.equal(design.background_image_url, null, "a broken picture url is dropped")
assert.equal(design.show_logo, false)
design = resolveGiftCardDesign({ theme: "jade", validity_months: 6, background_image_url: "https://example.test/fond.jpg" })
assert.equal(design.theme, "jade")
assert.equal(design.background_image_url, "https://example.test/fond.jpg")
console.log("PASS: the saved design overrides the defaults field by field, invalid values excluded")

assert.equal(giftCardValidityLabel({ validity_months: 12 }, new Date("2026-11-20T10:00:00Z")), "Valable jusqu'au 20/11/2027")
assert.equal(giftCardValidityLabel({ validity_months: null }), "Valable sans limite de durée")
console.log("PASS: validity reads as a date twelve months on, or as unlimited")

// ---- card text wrapping ----------------------------------------------------------

assert.deepEqual(plain(normalizeLines("Massage Thaï aux huiles chaudes Solo 1H", 34, 2)), ["Massage Thaï aux huiles chaudes", "Solo 1H"])
const wrapped = normalizeLines("Massage Thaï traditionnel pression et étirement en duo avec huiles chaudes", 34, 2)
assert.equal(wrapped.length, 2)
assert.match(wrapped[1], /…$/)
assert.deepEqual(plain(normalizeLines("")), [])
assert.deepEqual(plain(normalizeLines("  Court  ", 10, 1)), ["Court"])
console.log("PASS: the prestation name wraps on whole words and only the overflow is shortened")
