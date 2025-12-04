import fs from "fs"
import path from "path"

type DevSms = {
  id: string
  to: string
  message: string
  status: "queued" | "sent"
  queuedAt: number
  sentAt?: number
}

const storePath = path.resolve(process.cwd(), "tmp", "dev-sms.json")

function ensureFile() {
  const dir = path.dirname(storePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, "[]", "utf8")
}

function readAll(): DevSms[] {
  ensureFile()
  const raw = fs.readFileSync(storePath, "utf8")
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeAll(items: DevSms[]) {
  ensureFile()
  fs.writeFileSync(storePath, JSON.stringify(items, null, 2), "utf8")
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function createDevSms(to: string, message: string) {
  const items = readAll()
  const item: DevSms = {
    id: uid(),
    to,
    message,
    status: "queued",
    queuedAt: Date.now(),
  }
  items.push(item)
  writeAll(items)
  return item
}

export function listPendingDevSms(): DevSms[] {
  const items = readAll()
  return items.filter((x) => x.status === "queued")
}

export function markSentDevSms(id: string) {
  const items = readAll()
  const idx = items.findIndex((x) => x.id === id)
  if (idx < 0) return null
  const updated: DevSms = { ...items[idx], status: "sent", sentAt: Date.now() }
  items[idx] = updated
  writeAll(items)
  return updated
}

export type { DevSms }
