// Human-assisted Treatwell Connect login.
//
//   npm run sync:login -- treatwell
//
// Treatwell's login page has a Cloudflare Turnstile check that must be passed
// by a person, and it fails inside an automation-controlled browser. So this
// starts an ordinary Chrome window (its own profile under .sync/, nothing
// attached to it) on the login page and you sign in by hand, ticking « Rester
// connecté ». Once the agenda shows, the script attaches to that window over
// the DevTools protocol and records the agenda's API calls (without cookies or
// auth headers) to .sync/treatwell-capture.jsonl, so the Treatwell adapter can
// be built against the real endpoints. Closing the window stores the session
// cookies, encrypted, in platform_sessions; the sync reuses them until they
// expire.
import { spawn } from "node:child_process"
import { createCipheriv, createHash, randomBytes } from "node:crypto"
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
loadEnvFile(path.join(repoRoot, ".env"))
loadEnvFile(path.join(repoRoot, ".env.local"))

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex === -1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key || process.env[key]) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, "")
  }
}

// Same format as lib/sync/secret-box.ts.
function seal(value) {
  const secret = process.env.PLATFORM_SYNC_SECRET || process.env.JWT_SECRET
  if (!secret) throw new Error("PLATFORM_SYNC_SECRET (ou JWT_SECRET) manquant")
  const key = createHash("sha256").update(`${secret}:platform-sessions`).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":")
}

const platform = process.argv[2]
if (platform !== "treatwell") {
  console.error("Usage : npm run sync:login -- treatwell\n(Planity n'a pas besoin de connexion manuelle : la synchro se connecte seule.)")
  process.exit(1)
}

let chromium
try {
  ;({ chromium } = await import("playwright"))
} catch {
  console.error("Playwright n'est pas installé : npm install")
  process.exit(1)
}

const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find((candidate) => candidate && existsSync(candidate))
if (!CHROME) {
  console.error("Google Chrome introuvable : installez-le ou indiquez son chemin dans CHROME_PATH.")
  process.exit(1)
}

const ORIGIN = "https://connect.treatwell.fr"
const PORT = Number(process.env.SYNC_LOGIN_PORT) || 9227
const workDir = path.join(repoRoot, ".sync")
mkdirSync(workDir, { recursive: true })

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(workDir, "treatwell-chrome")}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--lang=fr-FR",
  `${ORIGIN}/login`,
], { stdio: "ignore" })
const chromeExited = new Promise((resolve) => chrome.on("exit", resolve))

console.log(`
Une fenêtre Chrome est ouverte sur Treatwell Connect (aucun robot n'y est branché).
  1. Validez la vérification Cloudflare, cochez « Rester connecté », cliquez sur « S'identifier ».
  2. Une fois l'agenda affiché, changez de jour/semaine et ouvrez un rendez-vous ou deux (sans rien modifier).
  3. Fermez la fenêtre : la session sera enregistrée.
`)

/** Tabs as listed by Chrome's HTTP endpoint; reading it does not attach anything to the page. */
async function tabs() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
    return response.ok ? await response.json() : []
  } catch {
    return []
  }
}
const isSignedIn = (url) => url.startsWith(ORIGIN) && !/\/(login|logout)/.test(new URL(url).pathname)

let exited = false
chromeExited.then(() => { exited = true })
while (!exited && !(await tabs()).some((tab) => tab.type === "page" && isSignedIn(tab.url))) {
  await new Promise((resolve) => setTimeout(resolve, 1500))
}
if (exited) {
  console.error("Fenêtre fermée avant la connexion : rien n'a été enregistré. Relancez la commande.")
  process.exit(1)
}

console.log("Connexion détectée. Enregistrement des appels de l'agenda… (fermez la fenêtre quand vous avez fini)")
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
const context = browser.contexts()[0]
const capture = createWriteStream(path.join(workDir, "treatwell-capture.jsonl"), { flags: "a" })
const SECRET_HEADERS = /^(cookie|authorization|x-csrf-token|x-xsrf-token)$/i

context.on("response", async (response) => {
  const request = response.request()
  if (!["xhr", "fetch"].includes(request.resourceType()) || !/treatwell/.test(new URL(request.url()).hostname)) return
  let body = ""
  try { body = (await response.text()).slice(0, 100_000) } catch {}
  const headers = Object.fromEntries(Object.entries(await request.allHeaders()).filter(([name]) => !SECRET_HEADERS.test(name)))
  capture.write(JSON.stringify({ t: Date.now(), method: request.method(), url: request.url(), status: response.status(), headers, post: request.postData()?.slice(0, 100_000), body }) + "\n")
})

// Reload once so the agenda's first calls (made before we attached) are recorded too.
const agenda = context.pages().find((page) => isSignedIn(page.url()))
await agenda?.reload({ waitUntil: "domcontentloaded" }).catch(() => {})

let cookies = []
let userAgent = ""
const snapshot = async () => {
  try {
    cookies = await context.cookies(ORIGIN)
    userAgent = (await agenda?.evaluate(() => navigator.userAgent)) || userAgent
  } catch {}
}
await snapshot()
const timer = setInterval(snapshot, 3000)
await new Promise((resolve) => browser.on("disconnected", resolve))
clearInterval(timer)
capture.end()

if (!cookies.length) {
  console.error("Aucun cookie Treatwell récupéré : rien n'a été enregistré. Relancez la commande.")
  process.exit(1)
}

const session = { cookies, userAgent, savedAt: new Date().toISOString() }
// Kept locally as well, so a missing migration doesn't cost a new login.
writeFileSync(path.join(workDir, "treatwell-session.enc"), seal(session))

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { error } = await supabase.from("platform_sessions").upsert({ platform: "treatwell", payload: seal(session), updated_at: new Date().toISOString() })
if (error) {
  console.error(`Session gardée dans .sync/treatwell-session.enc mais pas en base : ${error.message} (migration 2026-10-30_platform_sync.sql appliquée ?)`)
  process.exit(1)
}
console.log(`Session Treatwell enregistrée (${cookies.length} cookies). Appels de l'agenda enregistrés dans .sync/treatwell-capture.jsonl`)
