"use client"

import { useEffect, useState } from "react"
import { translations } from "./translations"
import type { Locale } from "@/i18n.config"

export function useTranslations() {
  const [locale, setLocale] = useState<Locale>("fr")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Get language from localStorage, default to French
    const stored = localStorage.getItem("language") as Locale | null
    if (stored && (stored === "fr" || stored === "en")) {
      setLocale(stored)
    } else {
      // Default to French
      setLocale("fr")
    }
  }, [])

  function t(path: string): string {
    const keys = path.split(".")
    let value: Record<string, unknown> | string = translations[locale]

    for (const key of keys) {
      if (typeof value === "object" && value !== null) {
        value = (value as Record<string, unknown>)[key] as Record<string, unknown> | string
      }
    }

    return typeof value === "string" ? value : path
  }

  return { t, locale, mounted }
}
