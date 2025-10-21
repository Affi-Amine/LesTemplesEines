import { translations } from "./translations"
import type { Locale } from "@/i18n.config"

export function getTranslations(locale: Locale) {
  return translations[locale] || translations.fr
}

export function t(locale: Locale, path: string): string {
  const keys = path.split(".")
  let value: Record<string, unknown> | string = translations[locale] || translations.fr

  for (const key of keys) {
    if (typeof value === "object" && value !== null) {
      value = (value as Record<string, unknown>)[key] as Record<string, unknown> | string
    }
  }

  return typeof value === "string" ? value : path
}
