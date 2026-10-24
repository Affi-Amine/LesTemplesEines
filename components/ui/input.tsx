import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, name, autoComplete, inputMode, spellCheck, ...props }: React.ComponentProps<"input">) {
  const field = props.id?.replace(/^quick-/, "") || ""
  const completions: Record<string, string> = { firstName: "given-name", first_name: "given-name", lastName: "family-name", last_name: "family-name", phone: "tel", email: "email" }
  return (
    <input
      type={type}
      name={name || props.id}
      autoComplete={autoComplete ?? completions[field]}
      inputMode={inputMode ?? (type === "tel" ? "tel" : type === "email" ? "email" : undefined)}
      spellCheck={spellCheck ?? (type === "email" ? false : undefined)}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-9 w-full min-w-0 rounded-md border bg-input/55 px-3 py-1 text-base shadow-xs transition-[color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
