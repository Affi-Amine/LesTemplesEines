"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"

export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState<"fr" | "en">("fr")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Get current language from localStorage
    const stored = localStorage.getItem("language") as "fr" | "en" | null
    if (stored && (stored === "fr" || stored === "en")) {
      setCurrentLang(stored)
    }
  }, [])

  const switchLanguage = (lang: "fr" | "en") => {
    localStorage.setItem("language", lang)
    setCurrentLang(lang)
    // Reload page to apply language change
    window.location.reload()
  }

  if (!mounted) return null

  return (
    <div className="flex gap-2">
      <Button
        variant={currentLang === "fr" ? "default" : "outline"}
        size="sm"
        onClick={() => switchLanguage("fr")}
        className="flex items-center gap-2"
        title="Français"
      >
        <Globe className="w-4 h-4" />
        FR
      </Button>
      <Button
        variant={currentLang === "en" ? "default" : "outline"}
        size="sm"
        onClick={() => switchLanguage("en")}
        className="flex items-center gap-2"
        title="English"
      >
        <Globe className="w-4 h-4" />
        EN
      </Button>
    </div>
  )
}
