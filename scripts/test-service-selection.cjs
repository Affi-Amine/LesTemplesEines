// Chaining prestations (two hours of the same massage, solo or duo) and which
// prestations may be sold as a gift card. Pure modules, no network.
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require(name) {
    return name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name)
  } })
  return exports
}

const { combineServices, getSelectedServiceIds, presentAppointmentServices } = load("lib/appointments/service-selection.ts")
const { isGiftCardEligible } = load("lib/gift-cards.ts")

const solo = { id: "huile-solo", name: "Massage huile chaude 1H", duration_minutes: 60, price_cents: 6500 }
const duo = { id: "huile-duo", name: "Massage huile chaude DUO 1H", duration_minutes: 60, price_cents: 9000, required_staff_count: 2 }
const reflexo = { id: "reflexo", name: "Réflexologie 30min", duration_minutes: 30, price_cents: 3500 }

// ---- two hours of the same massage ------------------------------------------

let combined = combineServices([solo, solo])
assert.equal(combined.duration_minutes, 120)
assert.equal(combined.price_cents, 13000)
assert.equal(combined.name, "Massage huile chaude 1H + Massage huile chaude 1H")
assert.equal(combined.required_staff_count, 1)
console.log("PASS: the same solo massage twice is a two-hour booking at twice the price")

combined = combineServices([duo, duo])
assert.equal(combined.duration_minutes, 120)
assert.equal(combined.price_cents, 18000)
assert.equal(combined.required_staff_count, 2, "a duo chained with itself still takes two masseuses")
console.log("PASS: the same duo massage twice keeps its two masseuses over two hours")

// Mixing stays allowed, and the staff count must still agree across the chain.
assert.equal(combineServices([solo, reflexo]).duration_minutes, 90)
assert.throws(() => combineServices([solo, duo]), /même nombre de masseuses/)
assert.throws(() => combineServices(Array.from({ length: 9 }, () => solo)), /entre 1 et 8/)
console.log("PASS: a chain mixes prestations of the same team size, up to eight")

// The selection sent to the API keeps both occurrences. The module runs in its
// own realm, so its arrays are compared by value.
const ids = (...args) => JSON.stringify(getSelectedServiceIds(...args))
assert.equal(ids(duo.id, [duo.id, duo.id]), JSON.stringify([duo.id, duo.id]))
assert.equal(ids(solo.id, [solo.id, reflexo.id, solo.id]), JSON.stringify([solo.id, reflexo.id, solo.id]))
assert.equal(ids(solo.id), JSON.stringify([solo.id]))
assert.throws(() => getSelectedServiceIds(solo.id, [reflexo.id]), /prestation principale/)
console.log("PASS: a repeated prestation survives the trip to the API, primary first")

// A booking already stored with the same prestation twice reads back as one chain.
const presented = presentAppointmentServices({ service: { name: "x" }, service_items: [solo, solo] })
assert.equal(presented.service.duration_minutes, 120)
assert.equal(presented.service.price_cents, 13000)
console.log("PASS: a chained booking reads back with its full duration and price on its card")

// ---- gift cards: limited-time offers are not sold ---------------------------

assert.equal(isGiftCardEligible({ category: "Massage SOLO" }), true)
assert.equal(isGiftCardEligible({ category: "Massage DUO" }), true)
assert.equal(isGiftCardEligible({ category: null }), true)
assert.equal(isGiftCardEligible({}), true)
for (const category of ["OFFRE Spéciale", "offre speciale", " Offre Spéciale ", "OFFRE SPECIALE"]) {
  assert.equal(isGiftCardEligible({ category }), false, category)
}
console.log("PASS: the opening offers (45 €, 49 €, 90 € duo) cannot be bought as a gift card, however their category is written")
