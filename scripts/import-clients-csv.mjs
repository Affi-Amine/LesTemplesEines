import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")

const DEFAULT_FILES = [
  {
    sourceSalon: "SAWAN",
    path: "C:\\Users\\eines\\OneDrive\\Bureau\\UPM\\Software Project Management\\final\\TEMPLE SAWAN Export Client 03.06.2026.csv",
  },
  {
    sourceSalon: "HANAY",
    path: "C:\\Users\\eines\\OneDrive\\Bureau\\UPM\\Software Project Management\\final\\TEMPLE HANAY Export Client 03.06.2026.csv",
  },
  {
    sourceSalon: "NUAD",
    path: "C:\\Users\\eines\\OneDrive\\Bureau\\UPM\\Software Project Management\\final\\Le Temple Nuad Export Client 03.06.2026.csv",
  },
]

const PLANITY_FILES = [
  {
    sourceSalon: "YADAM_PLANITY",
    path: "C:\\Users\\eines\\OneDrive\\Bureau\\UPM\\Software Project Management\\final\\fichier_client_planity_le-temple-yadam.csv",
  },
  {
    sourceSalon: "SAWAN_PLANITY",
    path: "C:\\Users\\eines\\OneDrive\\Bureau\\UPM\\Software Project Management\\final\\fichier_client_planity_temple-sawan.csv",
  },
]

const COLUMNS = [
  "fullName",
  "firstName",
  "lastName",
  "phone",
  "email",
  "notes",
  "validationStatus",
  "gender",
  "language",
  "birthDate",
  "birthMonth",
  "birthDay",
  "reservationCount",
  "createdAt",
]

const args = new Set(process.argv.slice(2))
const shouldCommit = args.has("--commit")
const shouldCheckDb = shouldCommit || args.has("--check-db")
const sourceMode = args.has("--planity") ? "planity" : "legacy"
const importTag = sourceMode === "planity" ? "[Planity CSV import 2026-06-28]" : "[CSV import 2026-06-03]"

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

function parseCsv(content) {
  const rows = []
  let row = []
  let value = ""
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        value += "\""
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(value)
      value = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1
      row.push(value)
      if (row.some((cell) => cell !== "")) rows.push(row)
      row = []
      value = ""
      continue
    }

    value += char
  }

  row.push(value)
  if (row.some((cell) => cell !== "")) rows.push(row)

  return rows
}

function normalizePhone(phone) {
  const normalized = String(phone || "")
    .replace(/[\s\u00a0\-()./]/g, "")
    .trim()

  return normalized || null
}

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase()
  return normalized || null
}

function normalizeDate(value) {
  const raw = String(value || "").trim()
  if (!raw) return null

  const parsed = new Date(raw.replace(" ", "T"))
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString()
}

function normalizeFrenchDate(value) {
  const raw = String(value || "").trim()
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString()
}

function normalizeDateOnly(value) {
  const raw = String(value || "").trim()
  if (!raw) return null

  const parsed = new Date(raw.replace(" ", "T"))
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString().slice(0, 10)
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ")
}

function splitPlanityName(fullName) {
  const cleaned = cleanName(fullName)
  if (!cleaned) return { firstName: "Client", lastName: "Non renseigne" }

  const parts = cleaned.split(" ")
  if (parts.length === 1) return { firstName: parts[0], lastName: "Non renseigne" }

  const [firstPart, ...rest] = parts
  const looksLikeUppercaseLastName = firstPart.length > 1 && firstPart === firstPart.toUpperCase()

  if (looksLikeUppercaseLastName) {
    return {
      firstName: cleanName(rest.join(" ")) || firstPart,
      lastName: firstPart,
    }
  }

  return {
    firstName: firstPart,
    lastName: cleanName(rest.join(" ")) || "Non renseigne",
  }
}

function buildImportNote(row) {
  const parts = [
    `source=${row.sourceSalon}`,
    row.fullName ? `full_name=${row.fullName}` : null,
    row.validationStatus ? `validation=${row.validationStatus}` : null,
    Number.isFinite(row.reservationCount) ? `reservations=${row.reservationCount}` : null,
    row.createdAt ? `source_created_at=${row.createdAt}` : null,
    row.deletedAt ? `source_deleted_at=${row.deletedAt}` : null,
    row.address ? `address=${row.address}` : null,
    row.postalCode ? `postal_code=${row.postalCode}` : null,
    row.city ? `city=${row.city}` : null,
    row.gender ? `gender=${row.gender}` : null,
    row.birthDate ? `birth_date=${row.birthDate}` : null,
    row.birthYear ? `birth_year=${row.birthYear}` : null,
  ].filter(Boolean)

  const note = parts.length ? `${importTag} ${parts.join("; ")}` : importTag
  return row.notes ? `${row.notes}\n${note}` : note
}

function parseSourceRows(fileConfig) {
  const content = readFileSync(fileConfig.path, "utf8").replace(/^\uFEFF/, "")
  const csvRows = parseCsv(content)
  const dataRows = csvRows.slice(1)

  return dataRows.map((cells, index) => {
    const record = Object.fromEntries(COLUMNS.map((column, cellIndex) => [column, cells[cellIndex] || ""]))
    const reservationCount = Number.parseInt(record.reservationCount || "0", 10)
    const firstName = cleanName(record.firstName || record.fullName)
    const lastName = cleanName(record.lastName) || "Non renseigne"
    const phone = normalizePhone(record.phone)
    const email = normalizeEmail(record.email)

    return {
      sourceSalon: fileConfig.sourceSalon,
      sourceRow: index + 2,
      fullName: cleanName(record.fullName),
      firstName,
      lastName,
      phone,
      email,
      notes: String(record.notes || "").trim(),
      validationStatus: String(record.validationStatus || "").trim(),
      gender: String(record.gender || "").trim(),
      language: String(record.language || "").trim(),
      birthDate: normalizeDateOnly(record.birthDate),
      reservationCount: Number.isFinite(reservationCount) ? reservationCount : 0,
      createdAt: normalizeDate(record.createdAt),
    }
  })
}

function parsePlanityRows(fileConfig) {
  const content = readFileSync(fileConfig.path, "utf8").replace(/^\uFEFF/, "")
  const csvRows = parseCsv(content)
  const header = csvRows[0] || []
  const dataRows = csvRows.slice(1)

  return dataRows.map((cells, index) => {
    const record = Object.fromEntries(header.map((column, cellIndex) => [column, cells[cellIndex] || ""]))
    const fullName = cleanName(record.Nom)
    const { firstName, lastName } = splitPlanityName(fullName)
    const deletedAt = normalizeFrenchDate(record["Supprimé le"])

    return {
      sourceSalon: fileConfig.sourceSalon,
      sourceRow: index + 2,
      fullName,
      firstName,
      lastName,
      phone: normalizePhone(record["Téléphone"]),
      email: normalizeEmail(record.Email),
      notes: String(record.Commentaires || "").trim(),
      validationStatus: "",
      gender: String(record.Genre || "").trim(),
      language: "",
      birthDate: String(record.Anniversaire || "").trim(),
      birthYear: String(record["Année de naissance"] || "").trim(),
      address: cleanName(record["N° et nom de rue"]),
      postalCode: String(record["Code postal"] || "").trim(),
      city: cleanName(record.Ville),
      reservationCount: 0,
      createdAt: normalizeFrenchDate(record["Crée le"]),
      deletedAt,
      loyaltyStatus: deletedAt ? "inactive" : "regular",
    }
  })
}

function choosePrimary(existing, candidate) {
  if (!existing) return candidate

  const existingScore = scoreRow(existing)
  const candidateScore = scoreRow(candidate)
  if (candidateScore !== existingScore) return candidateScore > existingScore ? candidate : existing

  const existingTime = existing.createdAt ? new Date(existing.createdAt).getTime() : 0
  const candidateTime = candidate.createdAt ? new Date(candidate.createdAt).getTime() : 0
  return candidateTime > existingTime ? candidate : existing
}

function scoreRow(row) {
  return [
    row.firstName && row.firstName !== "Non renseigne",
    row.lastName && row.lastName !== "Non renseigne",
    row.phone,
    row.email,
    row.notes,
  ].filter(Boolean).length
}

function mergeRows(rows) {
  const byKey = new Map()
  const skipped = []

  for (const row of rows) {
    const key = row.phone ? `phone:${row.phone}` : row.email ? `email:${row.email}` : null
    if (!key) {
      skipped.push({ ...row, reason: "missing_phone_and_email" })
      continue
    }

    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, {
        ...row,
        sourceSalons: new Set([row.sourceSalon]),
        sourceRows: [`${row.sourceSalon}:${row.sourceRow}`],
        reservationCount: row.reservationCount,
        importNotes: [buildImportNote(row)],
      })
      continue
    }

    const primary = choosePrimary(current, row)
    current.firstName = primary.firstName || current.firstName
    current.lastName = primary.lastName || current.lastName
    current.phone = current.phone || row.phone
    current.email = current.email || row.email
    current.createdAt = current.createdAt && row.createdAt
      ? new Date(current.createdAt) < new Date(row.createdAt) ? current.createdAt : row.createdAt
      : current.createdAt || row.createdAt
    current.reservationCount += row.reservationCount
    current.loyaltyStatus = current.loyaltyStatus === "inactive" && row.loyaltyStatus === "inactive"
      ? "inactive"
      : "regular"
    current.sourceSalons.add(row.sourceSalon)
    current.sourceRows.push(`${row.sourceSalon}:${row.sourceRow}`)
    current.importNotes.push(buildImportNote(row))
  }

  const clients = [...byKey.values()].map((row) => ({
    first_name: row.firstName || "Client",
    last_name: row.lastName || "Non renseigne",
    phone: row.phone,
    email: row.email,
    internal_notes: [...new Set(row.importNotes)].join("\n"),
    loyalty_status: row.loyaltyStatus || "regular",
    visit_count: Math.max(row.reservationCount || 0, 0),
    total_spent_cents: 0,
    created_at: row.createdAt || undefined,
    _source_salons: [...row.sourceSalons].sort(),
    _source_rows: row.sourceRows,
  }))

  return { clients, skipped }
}

function chunk(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size))
  return chunks
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function fetchExistingClients(supabase) {
  const existing = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, phone, email, first_name, last_name, internal_notes, visit_count, created_at")
      .range(from, from + pageSize - 1)

    if (error) throw error
    existing.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  return existing
}

function indexExistingClients(existingClients) {
  const byPhone = new Map()
  const byEmail = new Map()

  for (const client of existingClients) {
    const phone = normalizePhone(client.phone)
    const email = normalizeEmail(client.email)
    if (phone && !byPhone.has(phone)) byPhone.set(phone, client)
    if (email && !byEmail.has(email)) byEmail.set(email, client)
  }

  return { byPhone, byEmail }
}

function splitAgainstExisting(importClients, existingIndex) {
  const toInsert = []
  const toUpdate = []

  for (const client of importClients) {
    const existing = client.phone
      ? existingIndex.byPhone.get(client.phone)
      : client.email
        ? existingIndex.byEmail.get(client.email)
        : null

    if (!existing) {
      toInsert.push(client)
      continue
    }

    const update = {}
    if (!existing.first_name && client.first_name) update.first_name = client.first_name
    if (!existing.last_name && client.last_name) update.last_name = client.last_name
    if (!existing.phone && client.phone) update.phone = client.phone
    if (!existing.email && client.email) update.email = client.email
    if ((existing.visit_count || 0) < client.visit_count) update.visit_count = client.visit_count

    const importNote = client.internal_notes || ""
    if (importNote && !(existing.internal_notes || "").includes(importTag)) {
      update.internal_notes = existing.internal_notes ? `${existing.internal_notes}\n${importNote}` : importNote
    }

    if (Object.keys(update).length > 0) {
      toUpdate.push({ id: existing.id, update })
    }
  }

  return { toInsert, toUpdate }
}

async function commitImport(supabase, toInsert, toUpdate) {
  const affectedClientIds = []

  for (const batch of chunk(toInsert, 500)) {
    const rows = batch.map(({ _source_rows, _source_salons, ...client }) => client)
    const { data, error } = await supabase.from("clients").insert(rows).select("id")
    if (error) throw error
    affectedClientIds.push(...(data || []).map((client) => client.id))
  }

  for (const batch of chunk(toUpdate, 100)) {
    await Promise.all(batch.map(async ({ id, update }) => {
      const { error } = await supabase.from("clients").update(update).eq("id", id)
      if (error) throw error
      affectedClientIds.push(id)
    }))
  }

  let loyaltyPointsSkipped = false

  for (const batch of chunk([...new Set(affectedClientIds)], 500)) {
    const { error } = await supabase.from("loyalty_points").upsert(
      batch.map((clientId) => ({
        client_id: clientId,
        points_balance: 0,
        total_earned: 0,
        total_redeemed: 0,
      })),
      { onConflict: "client_id", ignoreDuplicates: true },
    )
    if (error?.code === "PGRST205") {
      loyaltyPointsSkipped = true
      break
    }
    if (error) throw error
  }

  return { affectedClientRows: affectedClientIds.length, loyaltyPointsSkipped }
}

async function main() {
  const selectedFiles = sourceMode === "planity" ? PLANITY_FILES : DEFAULT_FILES

  for (const file of selectedFiles) {
    if (!existsSync(file.path)) throw new Error(`Missing CSV file: ${file.path}`)
  }

  const sourceRows = selectedFiles.flatMap(sourceMode === "planity" ? parsePlanityRows : parseSourceRows)
  const { clients, skipped } = mergeRows(sourceRows)
  const missingLastName = sourceRows.filter((row) => row.lastName === "Non renseigne").length
  const duplicateRowsCollapsed = sourceRows.length - skipped.length - clients.length

  console.log(JSON.stringify({
    mode: shouldCommit ? "commit" : "dry-run",
    sourceMode,
    sourceRows: sourceRows.length,
    importableClientsAfterMerge: clients.length,
    skippedRows: skipped.length,
    duplicateRowsCollapsed,
    missingLastNameFallbacks: missingLastName,
    inactiveClientsFromDeletedSourceRows: clients.filter((client) => client.loyalty_status === "inactive").length,
    sourceRowsBySalon: Object.fromEntries(selectedFiles.map((file) => [
      file.sourceSalon,
      sourceRows.filter((row) => row.sourceSalon === file.sourceSalon).length,
    ])),
  }, null, 2))

  if (!shouldCheckDb) {
    console.log("Database check skipped. Run with --check-db to compare against existing clients.")
    return
  }

  const supabase = createSupabaseClient()
  const existingClients = await fetchExistingClients(supabase)
  const existingIndex = indexExistingClients(existingClients)
  const { toInsert, toUpdate } = splitAgainstExisting(clients, existingIndex)

  console.log(JSON.stringify({
    existingClients: existingClients.length,
    newClients: toInsert.length,
    existingClientsToUpdate: toUpdate.length,
  }, null, 2))

  if (!shouldCommit) {
    console.log("Dry-run only. Re-run with --commit to write to Supabase.")
    return
  }

  const result = await commitImport(supabase, toInsert, toUpdate)
  console.log(JSON.stringify({ committed: true, ...result }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
