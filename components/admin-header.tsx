interface AdminHeaderProps {
  title: string
  description?: string
}

export function AdminHeader({ title, description }: AdminHeaderProps) {
  return (
    <div className="border-b bg-card">
      <div className="flex min-w-0 items-start justify-between gap-3 p-3 sm:p-4 md:p-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground md:text-base">{description}</p>}
        </div>
      </div>
    </div>
  )
}
