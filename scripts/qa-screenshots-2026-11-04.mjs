// Screenshots of the cash sheet page and of this week's fixes, against a
// local `npm run dev`. Signs in with a locally minted admin token (JWT_SECRET
// from .env.local), uses the installed Google Chrome headless.
//
//   node scripts/qa-screenshots-2026-11-04.mjs [--url=http://localhost:3000] [--out=screenshots/2026-11-04]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import jwt from "jsonwebtoken"
import { chromium } from "playwright"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
for (const file of [".env", ".env.local"]) {
  const p = path.join(repoRoot, file)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true] }))
const BASE = (args.url || "http://localhost:3000").replace(/\/$/, "")
const OUT = path.resolve(repoRoot, args.out || "screenshots/2026-11-04")
mkdirSync(OUT, { recursive: true })

const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((c) => c && existsSync(c))
if (!CHROME) throw new Error("Google Chrome introuvable (CHROME_PATH)")
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET manquant dans .env.local")

const user = { staffId: "00000000-0000-4000-8000-000000000001", salonId: args.salon || "821f15ea-5651-41b6-8c0d-7f84e7b9de0a", email: "qa.local@les-temples.test", role: "admin", first_name: "QA", last_name: "Local" }
const token = jwt.sign({ staffId: user.staffId, salonId: user.salonId, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: "fr-FR", timezoneId: "Europe/Paris" })
const host = new URL(BASE).hostname
await context.addCookies([{ name: "accessToken", value: token, domain: host, path: "/" }])
await context.addInitScript((u) => {
  localStorage.setItem("adminToken", "authenticated")
  localStorage.setItem("adminUser", JSON.stringify({ id: u.staffId, salon_id: u.salonId, email: u.email, role: u.role, first_name: u.first_name, last_name: u.last_name }))
}, user)
const page = await context.newPage()
page.setDefaultTimeout(60_000)

const log = []
const only = args.only ? String(args.only).split(",") : null
async function shot(name, fn, { fullPage = false } = {}) {
  if (only && !only.some((prefix) => name.startsWith(prefix))) return
  try {
    await fn()
    await page.waitForTimeout(800)
    const file = path.join(OUT, `${name}.png`)
    await page.screenshot({ path: file, fullPage })
    log.push(`OK   ${name}`)
    console.log(`OK   ${name}`)
  } catch (error) {
    const file = path.join(OUT, `${name}-FAILED.png`)
    await page.screenshot({ path: file, fullPage }).catch(() => {})
    log.push(`FAIL ${name}: ${error.message.split("\n")[0]}`)
    console.log(`FAIL ${name}: ${error.message.split("\n")[0]}`)
  }
}
const settle = async () => { await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => {}) }

// ---- Fixes from the other session --------------------------------------------
await shot("01-login-nouveau-logo", async () => { await page.goto(`${BASE}/admin/login`); await settle() })
await shot("02-accueil-navbar-footer-logo", async () => { await page.goto(`${BASE}/`); await settle() }, { fullPage: true })
await shot("03-admin-sidebar-logo", async () => { await page.goto(`${BASE}/admin`); await settle() })
await shot("04-packs-clients-code-forfait", async () => { await page.goto(`${BASE}/admin/client-packs`); await settle(); await page.waitForTimeout(1500) })
await shot("05-mes-forfaits-code", async () => { await page.goto(`${BASE}/mes-forfaits`); await settle() })

// Agenda on a past day: quick-create on a past slot must no longer be refused.
const pastDay = args.day || "2026-11-01"
await shot("06-agenda-jour-passe", async () => { await page.goto(`${BASE}/admin/salons/${user.salonId}/dashboard?date=${pastDay}`); await settle(); await page.waitForTimeout(1500) })
await shot("07-agenda-rdv-planity-prix", async () => {
  // Open the first appointment card: the detail panel shows the price (NaN € fix for Planity imports).
  const card = page.locator("[data-appointment-id]").filter({ hasText: /€/ }).first()
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await card.click({ timeout: 10_000, force: true })
  await page.waitForTimeout(1000)
})
await shot("08-agenda-creation-creneau-passe", async () => {
  await page.goto(`${BASE}/admin/salons/${user.salonId}/dashboard?date=${pastDay}`); await settle(); await page.waitForTimeout(1200)
  await page.getByRole("button", { name: /Ajouter un rendez-vous/i }).first().click({ timeout: 10_000 })
  await page.waitForTimeout(1500)
})

// ---- Cash sheet ----------------------------------------------------------------
await shot("09-caisse-apercu", async () => { await page.goto(`${BASE}/admin/caisse`); await settle(); await page.waitForTimeout(1500) }, { fullPage: true })
await shot("10-caisse-date-passee", async () => {
  await page.goto(`${BASE}/admin/caisse`); await settle()
  await page.locator("#sheet-salon").selectOption(user.salonId)
  await page.locator("#sheet-date").fill(pastDay)
  await page.locator("#sheet-signer").fill("Joël")
  await settle(); await page.waitForTimeout(1500)
}, { fullPage: true })
await shot("11-caisse-parametres-auto-active", async () => {
  const card = page.getByText("Clôture automatique").first()
  await card.scrollIntoViewIfNeeded()
  const first = page.locator("[id^='signer-']").first()
  await first.fill("Joël")
  const id = (await first.getAttribute("id")).replace("signer-", "")
  await page.locator(`#time-${id}`).fill("23:00")
  await page.locator(`#to-${id}`).fill("caisse@les-temples.com")
  await page.locator(`button[aria-label^='Clôture automatique']`).first().click()
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: /^Enregistrer$/ }).first().click()
  await page.waitForTimeout(1500)
})
await shot("12-caisse-parametres-enregistres", async () => { await page.reload(); await settle(); await page.getByText("Clôture automatique").first().scrollIntoViewIfNeeded(); await page.waitForTimeout(800) })
await shot("13-caisse-parametres-auto-desactive", async () => {
  // Leave the salon as it was: automatic closing stays off after the QA run.
  await page.locator(`button[aria-label^='Clôture automatique']`).first().click()
  await page.waitForTimeout(300)
  await page.getByRole("button", { name: /^Enregistrer$/ }).first().click()
  await page.waitForTimeout(1200)
})

// The PDF, straight from the API with the same cookie.
try {
  const res = await context.request.get(`${BASE}/api/admin/cash-sheet/pdf?salon_id=${user.salonId}&date=${pastDay}`)
  if (res.ok()) {
    writeFileSync(path.join(OUT, `14-feuille-de-caisse-${pastDay}.pdf`), await res.body())
    log.push("OK   14-feuille-de-caisse pdf")
  } else log.push(`FAIL 14 pdf: ${res.status()} ${(await res.text()).slice(0, 200)}`)
} catch (error) {
  log.push(`FAIL 14 pdf: ${error.message}`)
}

await browser.close()
writeFileSync(path.join(OUT, "README.txt"), `Captures du ${new Date().toISOString()} contre ${BASE}\n\n${log.join("\n")}\n`)
console.log(`\n${log.join("\n")}\n\nDossier : ${OUT}`)
