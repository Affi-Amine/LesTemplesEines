// Aggregation and PDF rendering of the daily cash sheet, without a database.
// Runs lib/cash-sheet/build.ts and pdf.ts unchanged through the TypeScript
// transpiler; the example PDF is written next to the system temp folder.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const root = path.resolve(__dirname, "..")
const cache = new Map()

function load(file) {
  if (cache.has(file)) return cache.get(file)
  const source = fs.readFileSync(path.join(root, file), "utf8")
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = new Module(file)
  mod.filename = path.join(root, file)
  mod.paths = Module._nodeModulePaths(root)
  mod.require = (name) => (name.startsWith("@/") ? load(`${name.slice(2)}.ts`) : require(name))
  mod._compile(js, mod.filename)
  cache.set(file, mod.exports)
  return mod.exports
}

const { aggregateCashSheet, durationLabel, sheetReference } = load("lib/cash-sheet/build.ts")
const { renderCashSheetPdf, euros, cashSheetFilename } = load("lib/cash-sheet/pdf.ts")
const { sumAmounts } = load("lib/cash-sheet/types.ts")

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`PASS: ${name}`)
  } catch (error) {
    console.error(`FAIL: ${name}\n  ${error.message}`)
    process.exitCode = 1
  }
}

// 1 November 2026, Paris (UTC+1).
const at = (hhmm) => `2026-11-01T${hhmm}:00+01:00`
const plus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString()
const salon = { id: "s1", name: "Le Temple Nuad ", slug: "temple-Nuad ", address: "185 Avenue Jean Jaurès , Aubervilliers ", city: "Aubervilliers ", email: "temple.nuad@gmail.com" }
const staff = (name) => ({ first_name: "Madame", last_name: name })
let n = 0
const appointment = (overrides) => ({
  id: `a${++n}`,
  start_time: at("11:00"),
  end_time: plus(at("11:00"), 60),
  status: "confirmed",
  payment_status: "paid",
  payment_method: "card",
  amount_paid_cents: 6500,
  service_items: null,
  client: { first_name: "Hanina", last_name: "Bekhti" },
  service: { name: "Huiles chaudes", price_cents: 6500 },
  staff: [staff("Lea")],
  payments: [],
  ...overrides,
})

const appointments = [
  appointment({ start_time: at("11:00"), end_time: plus(at("11:00"), 60), client: null, staff: [staff("Pim")] }), // walk-in, card
  appointment({ start_time: at("11:07"), end_time: plus(at("11:07"), 60), payment_method: "loyalty", amount_paid_cents: 0, client: { first_name: "Elise", last_name: "KOUM EKINDI" }, staff: [staff("Soraya")] }),
  appointment({ start_time: at("13:45"), end_time: plus(at("13:45"), 60), payment_method: "cash", client: null, staff: [staff("Eiw")] }),
  appointment({ start_time: at("13:45"), end_time: plus(at("13:45"), 90), amount_paid_cents: 18000, service: { name: "Huiles chaudes (Duo)", price_cents: 18000 }, client: { first_name: "Sachita", last_name: "Faugoo" }, staff: [staff("Lea"), staff("Nuch")] }),
  appointment({ start_time: at("14:00"), end_time: plus(at("14:00"), 30), amount_paid_cents: 3500, service: { name: "Détente", price_cents: 3500 }, client: { first_name: "Hassiba", last_name: "REBBAH" }, staff: [staff("Pim")] }),
  // Mixed: 40 card + 25 cash recorded as two payments, plus a gift card on top.
  appointment({ start_time: at("15:00"), end_time: plus(at("15:00"), 60), payment_method: "mixed", amount_paid_cents: 6500, client: { first_name: "Bonita", last_name: "Colada" }, staff: [staff("Soraya")], payments: [{ amount_cents: 4000, method: "card" }, { amount_cents: 2500, method: "cash" }, { amount_cents: 0, method: "gift_card" }] }),
  appointment({ start_time: at("16:00"), end_time: plus(at("16:00"), 60), payment_method: "stripe", client: { first_name: "Mandip", last_name: "Nachhattar" }, staff: [staff("Nuch")] }),
  appointment({ start_time: at("17:00"), end_time: plus(at("17:00"), 60), payment_method: "treatwell", client: { first_name: "Aziz", last_name: "" }, staff: [staff("Nuch")] }),
  appointment({ start_time: at("17:30"), end_time: plus(at("17:30"), 60), payment_method: "on_site", client: { first_name: "Kieng", last_name: "Eav" }, staff: [staff("Lea")] }),
  appointment({ start_time: at("18:00"), end_time: plus(at("18:00"), 60), payment_method: "pack", amount_paid_cents: 0, client: { first_name: "Sabrina", last_name: "" }, staff: [staff("Pim")] }),
  appointment({ start_time: at("19:00"), end_time: plus(at("19:00"), 60), status: "no_show", client: { first_name: "Jean-Marc", last_name: "Huyghues-Beaufond" }, staff: [staff("Eiw")] }),
  appointment({ start_time: at("20:00"), end_time: plus(at("20:00"), 30), payment_status: "unpaid", payment_method: null, amount_paid_cents: 0, service: { name: "Huiles chaudes (Duo)", price_cents: 7000 }, client: { first_name: "Farri", last_name: "" }, staff: [staff("Nuch"), staff("Lea")] }),
  // Multi-service booking: price is the sum of the items.
  appointment({ start_time: at("12:00"), end_time: plus(at("12:00"), 90), amount_paid_cents: 7000, service: null, service_items: [{ name: "Détente", price_cents: 3500 }, { name: "Thai Traditional", price_cents: 3500 }], client: { first_name: "Bonita", last_name: "Colada" }, staff: [staff("Pim")] }),
  // Never on the sheet.
  appointment({ start_time: at("09:00"), end_time: plus(at("09:00"), 60), status: "cancelled" }),
  appointment({ start_time: at("09:30"), end_time: plus(at("09:30"), 60), status: "blocked", client: null, service: null }),
  appointment({ start_time: at("10:00"), end_time: plus(at("10:00"), 60), status: "pending", payment_status: "pending" }),
]

const sheet = aggregateCashSheet({ salon, date: "2026-11-01", appointments, signerName: "Joël", now: new Date("2026-11-01T19:06:00Z") })

test("sources are independent from payments, duo counts twice, partial never becomes fully paid", () => {
  const result = aggregateCashSheet({ salon, date: "2026-11-01", appointments: [
    appointment({ source: "planity", payment_method: "cash" }),
    appointment({ source: "treatwell", payment_status: "unpaid", amount_paid_cents: 0, payment_method: "treatwell", staff: [staff("A"), staff("B")] }),
    appointment({ source: "site", payment_status: "partial", amount_paid_cents: 2000, payment_method: "stripe" }),
    appointment({ source: "site", payment_status: "partial", amount_paid_cents: 0 }),
    appointment({ source: "planity", status: "no_show" }),
  ] })
  assert.equal(result.activity.singles, 3)
  assert.equal(result.activity.duos, 1)
  assert.equal(result.activity.total, 5)
  assert.deepEqual(result.activity.sources.treatwell, { bookings: 1, prestations: 2 })
  assert.equal(result.activity.sources.planity.bookings, 1)
  assert.equal(result.totals.treatwell, 0)
  assert.equal(result.totals.cash, 6500)
  assert.equal(result.totals.online, 2000)
  assert.equal(result.lines.filter(l => l.status === "partial").length, 2)
  assert.equal(result.activity.outstandingCents, 6500 + 4500 + 6500)
})

test("a recorded zero is never replaced by the catalogue price", () => {
  const result = aggregateCashSheet({ salon, date: "2026-11-01", appointments: [appointment({ amount_paid_cents: 0 })] })
  assert.equal(sumAmounts(result.totals), 0)
})

test("an 80 euro service covered by a 65 euro gift card leaves 15 euros, without cash receipts", () => {
  for (const payments of [[{ method: "gift_card", amount_cents: 6500 }], []]) {
    const result = aggregateCashSheet({ salon, date: "2026-11-01", appointments: [appointment({
      payment_status: "partial", payment_method: "gift_card", amount_paid_cents: 6500,
      service: { name: "Massage modifié", price_cents: 8000 }, payments,
    })] })
    assert.equal(result.activity.outstandingCents, 1500)
    assert.equal(result.lines[0].status, "partial")
    assert.equal(result.activity.partial, 1)
    assert.equal(sumAmounts(result.totals), 0)
    assert.equal(result.counts.giftCards, 1)
  }
})

test("a mixed card and gift payment deducts both from the balance but only card enters cash totals", () => {
  const result = aggregateCashSheet({ salon, date: "2026-11-01", appointments: [appointment({
    payment_status: "partial", payment_method: "mixed", amount_paid_cents: 8000,
    service: { name: "Massage", price_cents: 8000 },
    payments: [{ method: "card", amount_cents: 2000 }, { method: "gift_card", amount_cents: 4500 }],
  })] })
  // Payment rows are authoritative: do not fill their missing 15 euros from
  // the appointment's cumulative amount or count the voucher a second time.
  assert.equal(result.activity.outstandingCents, 1500)
  assert.equal(result.lines[0].status, "partial")
  assert.deepEqual(result.totals, { card: 2000, cash: 0, treatwell: 0, online: 0, other: 0 })
})

test("partial packs and stamp cards use only recorded coverage and keep missing values unpaid", () => {
  for (const method of ["pack", "loyalty"]) {
    for (const [payments, amountPaid, expectedDue] of [
      [[], null, 8000],
      [[], 0, 8000],
      [[], 3000, 5000],
      [[{ method, amount_cents: 0 }], 6500, 8000],
      [[{ method, amount_cents: 3000 }], 6500, 5000],
    ]) {
      const result = aggregateCashSheet({ salon, date: "2026-11-01", appointments: [appointment({
        payment_status: "partial", payment_method: method, amount_paid_cents: amountPaid,
        service: { name: "Massage", price_cents: 8000 }, payments,
      })] })
      assert.equal(result.activity.outstandingCents, expectedDue)
      assert.equal(result.lines[0].status, "partial")
      assert.equal(sumAmounts(result.totals), 0)
    }
  }
})

test("only sheet statuses are listed, sorted by time", () => {
  assert.equal(sheet.lines.length, 13)
  assert.deepEqual(sheet.lines.map((l) => l.time).slice(0, 4), ["11:00", "11:07", "12:00", "13:45"])
})

test("walk-in without a client card reads « Passage »", () => {
  assert.equal(sheet.lines[0].client, "Passage")
  assert.equal(sheet.lines[0].amounts.card, 6500)
})

test("card, cash, online, Treatwell and « sur place » land in their own columns", () => {
  const by = Object.fromEntries(sheet.lines.map((l) => [l.client, l.amounts]))
  assert.equal(by["Mandip Nachhattar"].online, 6500)
  assert.equal(by["Aziz"].treatwell, 6500)
  assert.equal(by["Kieng Eav"].other, 6500)
  assert.equal(sheet.lines[3].amounts.cash, 6500) // 13:45 Passage, cash
})

test("recorded payments drive the columns: mixed = one amount per method, voucher counted once", () => {
  const bonita = sheet.lines.find((l) => l.client === "Bonita Colada" && l.time === "15:00")
  assert.deepEqual(bonita.amounts, { card: 4000, cash: 2500, treatwell: 0, online: 0, other: 0 })
  assert.deepEqual(bonita.vouchers, ["gift_card"])
  assert.equal(sheet.counts.giftCards, 1)
})

test("stamp card and pack count people, not euros", () => {
  const elise = sheet.lines.find((l) => l.client === "Elise KOUM EKINDI")
  assert.deepEqual(elise.vouchers, ["stamp"])
  assert.equal(sumAmounts(elise.amounts), 0)
  assert.equal(sheet.counts.stamps, 1)
  assert.equal(sheet.counts.packs, 1)
})

test("no-show stays listed, without amount, its price goes to the non-cashed total", () => {
  const noShow = sheet.lines.find((l) => l.status === "no_show")
  assert.equal(noShow.client, "Jean-Marc Huyghues-Beaufond")
  assert.equal(sumAmounts(noShow.amounts), 0)
  assert.equal(sheet.counts.noShows, 1)
  assert.equal(sheet.noShowAmountCents, 6500)
})

test("unpaid line is listed, counted and kept out of the totals", () => {
  const farri = sheet.lines.find((l) => l.client === "Farri")
  assert.equal(farri.status, "unpaid")
  assert.equal(sheet.counts.unpaid, 1)
  assert.equal(sheet.unpaidAmountCents, 7000)
})

test("multi-service booking: joined name, price = sum of items", () => {
  const multi = sheet.lines.find((l) => l.time === "12:00")
  assert.equal(multi.service, "Détente + Thai Traditional")
  assert.equal(multi.amounts.card, 7000)
})

test("totals add up per column", () => {
  assert.deepEqual(sheet.totals, { card: 6500 + 18000 + 3500 + 4000 + 7000, cash: 6500 + 2500, treatwell: 6500, online: 6500, other: 6500 })
  assert.equal(sheet.counts.lines, 13)
})

test("duo shows both masseuses, duration uses the sheet notation", () => {
  const duo = sheet.lines.find((l) => l.client === "Sachita Faugoo")
  assert.equal(duo.staff, "Lea, Nuch")
  assert.equal(duo.duration, "1.30")
  assert.equal(durationLabel(at("14:00"), plus(at("14:00"), 30)), "0.30")
  assert.equal(durationLabel(at("14:00"), plus(at("14:00"), 60)), "1.00")
})

test("reference and salon header are derived from the salon", () => {
  assert.equal(sheet.reference, "FC-20261101-NUAD")
  assert.equal(sheetReference({ name: "Le Temple Ayara", slug: "temple-meaux" }, "2026-11-04"), "FC-20261104-MEAUX")
  assert.equal(sheet.salon.name, "Le Temple Nuad")
  assert.equal(sheet.signerName, "Joël")
})

test("euro formatting matches the document (thin thousands separator, comma)", () => {
  assert.equal(euros(134500), "1 345,00")
  assert.equal(euros(6500), "65,00")
  assert.equal(cashSheetFilename(sheet), "Feuille-de-caisse_2026-11-01_NUAD.pdf")
})

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "cash-sheet-"))
Promise.all([
  renderCashSheetPdf({ ...sheet, closedAt: "2026-11-01T19:06:00Z" }),
  renderCashSheetPdf(sheet),
  renderCashSheetPdf({ ...sheet, lines: [], totals: { card: 0, cash: 0, treatwell: 0, online: 0, other: 0 }, counts: { lines: 0, giftCards: 0, packs: 0, stamps: 0, noShows: 0, unpaid: 0 }, noShowAmountCents: 0, unpaidAmountCents: 0 }),
])
  .then(([closed, preview, empty]) => {
    test("PDF renders for a closed day, a preview and an empty day", () => {
      for (const pdf of [closed, preview, empty]) {
        assert.ok(Buffer.isBuffer(pdf) && pdf.length > 5000, "pdf too small")
        assert.equal(pdf.subarray(0, 5).toString(), "%PDF-")
      }
    })
    fs.writeFileSync(path.join(outDir, "feuille-closed.pdf"), closed)
    fs.writeFileSync(path.join(outDir, "feuille-preview.pdf"), preview)
    fs.writeFileSync(path.join(outDir, "feuille-empty.pdf"), empty)
    console.log(`\n${passed} tests passed. Example PDFs: ${outDir}`)
  })
  .catch((error) => {
    console.error("FAIL: PDF rendering\n  ", error)
    process.exitCode = 1
  })
