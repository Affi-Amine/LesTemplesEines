// Runs the Planity / Treatwell synchronisation through its cron endpoint and
// prints a readable report.
//
//   npm run sync:platforms                     dry run against APP_URL
//   npm run sync:platforms -- --live           apply (needs PLATFORM_SYNC_MODE=live on the server)
//   npm run sync:platforms -- --platform=planity --url=http://localhost:3000
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

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

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=")
  return [key, value ?? true]
}))
const base = (args.url || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")
const query = new URLSearchParams()
if (!args.live) query.set("mode", "dry-run")
if (args.platform) query.set("platform", args.platform)

if (!process.env.CRON_SECRET) {
  console.error("CRON_SECRET manquant dans .env.local")
  process.exit(1)
}

const response = await fetch(`${base}/api/cron/platform-sync?${query}`, {
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
}).catch((error) => {
  console.error(`Impossible de joindre ${base} (${error.message}). Lancez \`npm run dev\` ou passez --url=...`)
  process.exit(1)
})
const report = await response.json().catch(() => ({}))
if (!response.ok) {
  console.error(`Échec (${response.status}) :`, report.error || report.skipped || report)
  process.exit(1)
}

const LABELS = {
  import: "importés sur le site",
  match: "déjà présents des deux côtés (reliés)",
  push: "envoyés sur la plateforme",
  update_local: "modifiés sur le site",
  update_remote: "modifiés sur la plateforme",
  cancel_local: "annulés sur le site",
  cancel_remote: "annulés sur la plateforme",
}

console.log(`\n${report.mode === "live" ? "SYNCHRONISATION" : "APERÇU (dry-run, rien n'est écrit)"} · ${report.window.from} → ${report.window.to} · ${report.durationMs} ms`)
for (const [platform, r] of Object.entries(report.platforms)) {
  console.log(`\n=== ${platform.toUpperCase()} : ${r.status}${r.message ? ` — ${r.message}` : ""}`)
  if (r.mapping) {
    console.log(`Salons : ${r.mapping.salons.map((s) => `${s.salon} ↔ ${s.venue}`).join(" | ") || "aucun"}`)
    if (r.mapping.unmappedVenues.length) console.log(`Établissements sans salon : ${r.mapping.unmappedVenues.join(", ")}`)
    console.log(`Masseuses : ${r.mapping.staff.map((s) => `${s.staff}→${s.column}`).join(", ") || "aucune"}`)
    if (r.mapping.unmappedColumns.length) console.log(`Colonnes non associées : ${r.mapping.unmappedColumns.join(", ")}`)
    console.log(`Prestations associées : ${r.mapping.services}`)
  }
  if (r.status !== "ok") continue
  console.log(`Rendez-vous lus sur la plateforme : ${r.fetched}`)
  for (const [kind, count] of Object.entries(r.counts)) if (count) console.log(`  ${String(count).padStart(4)} ${LABELS[kind]}`)
  const limit = Number(args.details) || 15
  for (const kind of Object.keys(LABELS)) {
    const items = r.actions.filter((a) => a.kind === kind)
    if (!items.length) continue
    console.log(`\n  ${LABELS[kind]} :`)
    for (const item of items.slice(0, limit)) console.log(`    - ${item.detail}`)
    if (items.length > limit) console.log(`    … et ${items.length - limit} autres (--details=${items.length})`)
  }
  if (r.warnings.length) {
    console.log(`\n  ${r.warnings.length} avertissement(s) :`)
    for (const warning of r.warnings.slice(0, limit)) console.log(`    ! ${warning}`)
    if (r.warnings.length > limit) console.log(`    … et ${r.warnings.length - limit} autres`)
  }
}
console.log("")
