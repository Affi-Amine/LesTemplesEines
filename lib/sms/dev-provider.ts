import { createDevSms, listPendingDevSms, markSentDevSms } from "./dev-store"

export async function devSendSms(to: string, message: string) {
  const item = createDevSms(to, message)
  return { id: item.id, status: item.status }
}

export async function devListPending() {
  const items = listPendingDevSms()
  return items.map((x) => ({ id: x.id, to: x.to, message: x.message, status: x.status }))
}

export async function devMarkSent(id: string) {
  const updated = markSentDevSms(id)
  if (!updated) return null
  return { id: updated.id, status: updated.status }
}
