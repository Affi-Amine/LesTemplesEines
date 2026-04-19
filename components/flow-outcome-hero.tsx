"use client"

import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Clock3, TriangleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type FlowOutcomeStatus = "success" | "pending" | "error"

const iconMap: Record<FlowOutcomeStatus, LucideIcon> = {
  success: CheckCircle2,
  pending: Clock3,
  error: TriangleAlert,
}

const styles = {
  success: {
    ring: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    iconWrap: "border-emerald-400/20 bg-emerald-500/12",
    icon: "text-emerald-300",
    eyebrow: "text-emerald-300",
  },
  pending: {
    ring: "border-amber-300/20 bg-amber-500/10 text-amber-100",
    iconWrap: "border-amber-300/20 bg-amber-500/12",
    icon: "text-amber-200",
    eyebrow: "text-amber-200",
  },
  error: {
    ring: "border-destructive/20 bg-destructive/10 text-foreground",
    iconWrap: "border-destructive/20 bg-destructive/12",
    icon: "text-destructive",
    eyebrow: "text-destructive",
  },
}

interface FlowOutcomeHeroProps {
  status: FlowOutcomeStatus
  eyebrow: string
  title: string
  description: string
  helper?: string
  className?: string
}

export function FlowOutcomeHero({
  status,
  eyebrow,
  title,
  description,
  helper,
  className,
}: FlowOutcomeHeroProps) {
  const Icon = iconMap[status]
  const tone = styles[status]

  return (
    <Card className={cn("gap-0 overflow-hidden rounded-[1.75rem] border-primary/15 py-0 temple-frame", className)}>
      <div className="bg-[linear-gradient(180deg,rgba(214,171,89,0.06),rgba(214,171,89,0.01))] px-6 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className={cn("mx-auto mb-5 flex h-18 w-18 items-center justify-center rounded-full border sm:h-20 sm:w-20", tone.iconWrap)}>
            <Icon className={cn("h-9 w-9 sm:h-10 sm:w-10", tone.icon)} />
          </div>
          <p className={cn("text-xs font-semibold uppercase tracking-[0.28em] sm:text-sm", tone.eyebrow)}>{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-serif font-bold leading-tight sm:text-4xl md:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
          {helper ? (
            <div className={cn("mx-auto mt-6 max-w-2xl rounded-2xl border px-4 py-3 text-sm leading-6", tone.ring)}>
              {helper}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
