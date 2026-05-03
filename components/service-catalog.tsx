"use client"

import { useMemo, useState } from "react"
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

function normalizeCategoryKey(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function formatCategoryLabel(value: string | null | undefined) {
  const category = (value || "").trim().replace(/\s+/g, " ")
  if (!category) return "Autres prestations"

  return category
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|\s|-|')([\p{L}])/gu, (match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("fr-FR")}`)
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
    const groups = new Map<string, { category: string; items: T[] }>()

    services.forEach((service) => {
      const category = formatCategoryLabel(service.category)
      const key = normalizeCategoryKey(category) || "autres prestations"
      const existingGroup = groups.get(key)

      if (existingGroup) {
        existingGroup.items.push(service)
      } else {
        groups.set(key, { category, items: [service] })
      }
    })

    return Array.from(groups.values())
  }, [services])

  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())

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
    document.getElementById(`service-category-${normalizeCategoryKey(category)}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className={cn("space-y-2.5 sm:space-y-4", className)}>
      {groupedServices.length > 1 ? (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:gap-2 sm:px-1">
          {groupedServices.map((group) => (
            <button
              key={group.category}
              type="button"
              onClick={() => jumpToCategory(group.category)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors sm:px-3.5 sm:py-2 sm:text-xs",
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

      <div className="overflow-hidden rounded-xl border border-primary/10 bg-background/22 shadow-none backdrop-blur-sm sm:rounded-2xl sm:bg-[linear-gradient(180deg,rgba(31,25,20,0.78),rgba(17,14,12,0.9))] sm:shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
        {groupedServices.map((group) => {
          const isOpen = openCategories.has(group.category)

          return (
            <section key={group.category} id={`service-category-${normalizeCategoryKey(group.category)}`} className="scroll-mt-28 border-b border-primary/10 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleCategory(group.category)}
                className="flex w-full items-center justify-between gap-4 px-3 py-3 text-left transition-colors hover:bg-primary/5 sm:px-5 sm:py-4"
                aria-expanded={isOpen}
              >
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-primary sm:text-xs sm:tracking-[0.16em]">{group.category}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">{group.items.length} prestation{group.items.length > 1 ? "s" : ""}</span>
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
                          "grid w-full grid-cols-[1fr_auto] gap-2 px-3 py-2.5 text-left transition-colors sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3 sm:px-5 sm:py-4",
                          selectable ? "cursor-pointer hover:bg-primary/6" : "cursor-default",
                          isSelected && "bg-primary/8"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex items-start gap-2.5 sm:gap-3">
                            {selectable ? (
                              <span
                                className={cn(
                                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border sm:h-5 sm:w-5",
                                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-primary/25"
                                )}
                              >
                                {isSelected ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : null}
                              </span>
                            ) : null}
                            <span className="min-w-0">
                              <span className="block break-words text-[0.82rem] font-semibold leading-snug text-foreground sm:text-base">
                                {service.name}
                              </span>
                              {badge ? (
                                <span className="mt-1.5 inline-flex rounded-full border border-primary/15 bg-primary/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary sm:mt-2 sm:px-2.5 sm:py-1 sm:text-[10px]">
                                  {badge}
                                </span>
                              ) : null}
                              {showDescriptions && service.description ? (
                                <span
                                  className={cn(
                                    "mt-1.5 block text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6",
                                    compact ? "line-clamp-1" : "line-clamp-2"
                                  )}
                                >
                                  {service.description}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </span>

                        <span className="flex min-w-[4.15rem] flex-col items-end justify-center gap-0.5 text-right sm:min-w-[5rem] sm:gap-1">
                          <span className="text-[0.8rem] font-semibold text-primary sm:text-[0.95rem]">{formatPrice(service)}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground sm:text-xs">
                            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
