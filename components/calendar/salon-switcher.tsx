"use client"

import { ChevronDown } from "lucide-react"

export function SalonSwitcher({ value, salons, onChange, fallbackName }: {
  value: string
  salons: { id: string; name: string }[]
  onChange: (id: string) => void
  fallbackName: string
}) {
  return <span className="relative block min-w-0">
    <select aria-label="Changer de salon" value={value} disabled={!salons.length}
      onChange={event => { if (event.target.value !== value) onChange(event.target.value) }}
      className="h-11 w-full min-w-0 appearance-none truncate rounded-md bg-transparent pr-7 text-base font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-lg">
      {!salons.some(salon => salon.id === value) && <option value={value}>{fallbackName}</option>}
      {salons.map(salon => <option key={salon.id} value={salon.id}>{salon.name}</option>)}
    </select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  </span>
}
