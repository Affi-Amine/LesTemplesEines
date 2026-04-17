"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Flower2, Menu, X } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { LanguageSwitcher } from "@/components/language-switcher"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { t, mounted } = useTranslations()

  if (!mounted) return null

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-primary/15 bg-background/72 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-[radial-gradient(circle_at_30%_30%,rgba(255,230,184,0.25),rgba(214,171,89,0.12)_45%,rgba(14,11,9,0.5)_100%)] shadow-[0_0_24px_rgba(214,171,89,0.14)]">
            <Flower2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-xl font-semibold tracking-[0.08em] text-foreground group-hover:text-primary">Les Temples</span>
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">Massage thailandais</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {t("nav.home")}
          </Link>
          <Link href="/book" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {t("nav.book")}
          </Link>
          <Link href="/gift" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Cartes cadeaux
          </Link>
          <Link href="/jai-une-carte-cadeau" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            J&apos;ai une carte cadeau
          </Link>
          <Link href="#salons" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Salons
          </Link>
          <Link href="#rituels" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Rituels
          </Link>
          <Link href="#services" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Soins
          </Link>
          <Link href="#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Contact
          </Link>
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm" className="text-sm hover:bg-primary/10 hover:text-primary">
            <Link href="/admin/login">{t("admin.login")}</Link>
          </Button>
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_8px_24px_rgba(214,171,89,0.18)]">
            <Link href="/book">{t("home.cta_book")}</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 hover:bg-primary/10 rounded-lg transition-colors"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-primary/15 bg-background/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.home")}
            </Link>
            <Link href="/book" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.book")}
            </Link>
            <Link href="/gift" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cartes cadeaux
            </Link>
            <Link href="/jai-une-carte-cadeau" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              J&apos;ai une carte cadeau
            </Link>
            <Link href="#salons" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Salons
            </Link>
            <Link href="#rituels" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Rituels
            </Link>
            <Link href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Soins
            </Link>
            <Link href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
            <div className="flex gap-2 pt-2">
              <LanguageSwitcher />
            </div>
            <div className="flex gap-2 pt-2">
              <Button asChild variant="outline" size="sm" className="flex-1 w-full bg-transparent">
                <Link href="/admin/login">{t("admin.login")}</Link>
              </Button>
              <Button asChild size="sm" className="flex-1 w-full bg-primary hover:bg-primary/90">
                <Link href="/book">{t("home.cta_book")}</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
