// Name and phone normalisation used to pair records across the three systems.

/** "Le Temple Hanay " -> "hanay"; "Pun ( HOMME)" -> "pun"; "Mhee F" -> "mhee". */
export function nameKey(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !["le", "la", "les", "temple", "temples", "homme", "femme", "madame", "monsieur", "f", "h"].includes(word))
    .join(" ")
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

/** Same name, allowing one typo for names of 4+ letters ("Villa" / "Vila"). */
export function namesMatch(a: string, b: string) {
  const x = nameKey(a)
  const y = nameKey(b)
  if (!x || !y) return false
  if (x === y) return true
  return Math.min(x.length, y.length) >= 4 && levenshtein(x, y) <= 1
}

/** Word overlap between two service names, 0..1. */
export function nameSimilarity(a: string, b: string) {
  const x = new Set(nameKey(a).split(" ").filter(Boolean))
  const y = new Set(nameKey(b).split(" ").filter(Boolean))
  if (!x.size || !y.size) return 0
  const shared = [...x].filter((word) => y.has(word)).length
  return shared / new Set([...x, ...y]).size
}

/**
 * Pairs each left item with at most one right item and vice versa. A left item
 * with two equally good candidates stays unpaired rather than guessing.
 */
export function pairUnique<L, R>(left: L[], right: R[], score: (l: L, r: R) => number, minimum: number) {
  const best = new Map<L, R>()
  for (const l of left) {
    const ranked = right.map((r) => ({ r, s: score(l, r) })).filter((c) => c.s >= minimum).sort((a, b) => b.s - a.s)
    if (ranked.length && (ranked.length === 1 || ranked[0].s > ranked[1].s)) best.set(l, ranked[0].r)
  }
  const claims = new Map<R, number>()
  for (const r of best.values()) claims.set(r, (claims.get(r) || 0) + 1)
  return new Map([...best].filter(([, r]) => claims.get(r) === 1))
}

/** French numbers: local rows hold "06 12 34 56 78" or "+33 6 12…", platforms "+33612345678". */
export function phoneVariants(phone: string | null | undefined) {
  const compact = (phone || "").replace(/[\s \-.()/]/g, "")
  if (!compact) return []
  if (/^\+33\d{9}$/.test(compact)) return [compact, `0${compact.slice(3)}`]
  if (/^0\d{9}$/.test(compact)) return [compact, `+33${compact.slice(1)}`]
  if (/^0033\d{9}$/.test(compact)) return [`+${compact.slice(2)}`, `0${compact.slice(4)}`]
  return [compact]
}

export function toE164(phone: string | null | undefined) {
  return phoneVariants(phone).find((variant) => variant.startsWith("+")) || null
}

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return { firstName: parts[0] || "Client", lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}
