"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { LanguageSwitcher } from "@/components/language-switcher"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { t, mounted } = useTranslations()

  if (!mounted) return null

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-primary/10">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">✦</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-foreground tracking-tight">Les Temples</span>
            <span className="text-xs text-muted-foreground">Wellness</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t("nav.home")}
          </Link>
          <Link href="/book" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t("nav.book")}
          </Link>
          <Link href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t("nav.salons")}
          </Link>
          <Link href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Contact
          </Link>
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/admin/login">
            <Button variant="ghost" size="sm" className="text-sm">
              {t("admin.login")}
            </Button>
          </Link>
          <Link href="/book">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {t("home.cta_book")}
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-primary/10 bg-background/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.home")}
            </Link>
            <Link href="/book" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.book")}
            </Link>
            <Link href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.salons")}
            </Link>
            <Link href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
            <div className="flex gap-2 pt-2">
              <LanguageSwitcher />
            </div>
            <div className="flex gap-2 pt-2">
              <Link href="/admin/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  {t("admin.login")}
                </Button>
              </Link>
              <Link href="/book" className="flex-1">
                <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
                  {t("home.cta_book")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
