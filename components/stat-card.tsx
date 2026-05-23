import { Card } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function StatCard({ title, value, description, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 truncate text-sm text-muted-foreground">{title}</p>
          <p className="break-words text-2xl font-bold leading-tight sm:text-3xl">{value}</p>
          {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
          {trend && (
            <p className={`mt-2 text-xs ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% from last month
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
            <Icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          </div>
        )}
      </div>
    </Card>
  )
}
