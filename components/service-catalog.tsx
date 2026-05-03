"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Check, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ServiceCatalogItem {
  id: string
  name: string
  description?: string | null
  duration_minutes?: number
  duration?: number
  price_cents?: number
  price?: number
  category?: string | null
}

interface ServiceCatalogProps<T extends ServiceCatalogItem> {
  services: T[]
  selectedServiceId?: string
  onSelectService?: (serviceId: string) => void
  getBadge?: (service: T) => string | null
  selectable?: boolean
  compact?: boolean
  showDescriptions?: boolean
  className?: string
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function inferCategory(service: ServiceCatalogItem) {
  const explicitCategory = service.category?.trim()
  if (explicitCategory) return explicitCategory

  const name = normalize(service.name)
  if (name.includes("duo") || name.includes("personnes")) return "Duo & groupes"
  if (name.includes("hammam") || name.includes("privatif")) return "Hammam"
  if (name.includes("reflex") || name.includes("plantaire") || name.includes("pied")) return "Reflexologie"
  if (name.includes("cranien") || name.includes("visage") || name.includes("tete")) return "Cibles"
  return "Massages"
}

function formatPrice(service: ServiceCatalogItem) {
  const price = typeof service.price_cents === "number" ? service.price_cents / 100 : service.price
  return `${(price || 0).toFixed(2)}€`
}

function formatDuration(service: ServiceCatalogItem) {
  const duration = service.duration_minutes ?? service.duration ?? 0
  return `${duration} min`
}

export function ServiceCatalog<T extends ServiceCatalogItem>({
  services,
  selectedServiceId,
  onSelectService,
  getBadge,
  selectable = true,
  compact = false,
  showDescriptions = true,
  className,
}: ServiceCatalogProps<T>) {
  const groupedServices = useMemo(() => {
    const groups = new Map<string, T[]>()

    services.forEach((service) => {
      const category = inferCategory(service)
      groups.set(category, [...(groups.get(category) || []), service])
    })

    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items,
    }))
  }, [services])

  const [openCategories, setOpenCategories] = useState(() => new Set(groupedServices[0] ? [groupedServices[0].category] : []))

  useEffect(() => {
    setOpenCategories((current) => {
      const availableCategories = new Set(groupedServices.map((group) => group.category))
      const next = new Set(Array.from(current).filter((category) => availableCategories.has(category)))

      if (next.size > 0 || !groupedServices[0]) return next
      return new Set([groupedServices[0].category])
    })
  }, [groupedServices])

  useEffect(() => {
    if (!selectedServiceId) return
    const selectedGroup = groupedServices.find((group) =>
      group.items.some((service) => service.id === selectedServiceId)
    )
    if (!selectedGroup) return

    setOpenCategories((current) => new Set(current).add(selectedGroup.category))
  }, [groupedServices, selectedServiceId])

  const toggleCategory = (category: string) => {
    setOpenCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const jumpToCategory = (category: string) => {
    setOpenCategories((current) => new Set(current).add(category))
    document.getElementById(`service-category-${category}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      {groupedServices.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-1">
          {groupedServices.map((group) => (
            <button
              key={group.category}
              type="button"
              onClick={() => jumpToCategory(group.category)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
                openCategories.has(group.category)
                  ? "border-primary/35 bg-primary/10 text-foreground"
                  : "border-primary/12 bg-background/25 text-muted-foreground hover:border-primary/35 hover:text-foreground"
              )}
            >
              {group.category}
              <span className="ml-2 text-primary/75">{group.items.length}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.1rem] border border-primary/10 bg-background/28 shadow-none backdrop-blur-sm sm:rounded-2xl sm:bg-[linear-gradient(180deg,rgba(31,25,20,0.78),rgba(17,14,12,0.9))] sm:shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
        {groupedServices.map((group) => {
          const isOpen = openCategories.has(group.category)

          return (
            <section key={group.category} id={`service-category-${group.category}`} className="scroll-mt-28 border-b border-primary/10 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleCategory(group.category)}
                className="flex w-full items-center justify-between gap-4 px-3.5 py-3.5 text-left transition-colors hover:bg-primary/5 sm:px-5 sm:py-4"
                aria-expanded={isOpen}
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-primary sm:text-sm sm:tracking-[0.18em]">{group.category}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{group.items.length} prestation{group.items.length > 1 ? "s" : ""}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-primary transition-transform sm:h-5 sm:w-5", isOpen ? "rotate-180" : "")} />
              </button>

              {isOpen ? (
                <div className="divide-y divide-primary/10">
                  {group.items.map((service) => {
                    const isSelected = selectedServiceId === service.id
                    const badge = getBadge?.(service)

                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => onSelectService?.(service.id)}
                        disabled={!selectable}
                        className={cn(
                          "grid w-full grid-cols-[1fr_auto] gap-3 px-3.5 py-3.5 text-left transition-colors sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-5 sm:py-4",
                          selectable ? "cursor-pointer hover:bg-primary/6" : "cursor-default",
                          isSelected && "bg-primary/8"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex items-start gap-3">
                            {selectable ? (
                              <span
                                className={cn(
                                  "mt-0.5 flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full border sm:h-5 sm:w-5",
                                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-primary/25"
                                )}
                              >
                                {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                              </span>
                            ) : null}
                            <span className="min-w-0">
                              <span className="block break-words text-[0.94rem] font-semibold leading-snug text-foreground sm:text-base">
                                {service.name}
                              </span>
                              {badge ? (
                                <span className="mt-2 inline-flex rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                                  {badge}
                                </span>
                              ) : null}
                              {showDescriptions && service.description ? (
                                <span
                                  className={cn(
                                    "mt-2 block text-sm leading-6 text-muted-foreground",
                                    compact ? "line-clamp-1" : "line-clamp-2"
                                  )}
                                >
                                  {service.description}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </span>

                        <span className="flex min-w-[5rem] flex-col items-end justify-center gap-1 text-right">
                          <span className="text-[0.92rem] font-semibold text-primary sm:text-[0.95rem]">{formatPrice(service)}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDuration(service)}
                          </span>
                        </span>

                        {!selectable ? <span className="hidden sm:block" /> : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
