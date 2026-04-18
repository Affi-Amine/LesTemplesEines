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
    <nav className="fixed top-0 z-50 w-full border-b border-primary/15 bg-background/78 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-gradient-to-br from-primary via-primary to-primary/70 shadow-[0_0_24px_rgba(214,171,89,0.18)]">
            <span className="text-lg font-bold text-primary-foreground">✦</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">Les Temples</span>
            <span className="text-[11px] uppercase tracking-[0.24em] text-primary/80">Thaïlande • maisons de massage</span>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
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
          <Link href="#services" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Soins
          </Link>
          <Link href="#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Contact
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm" className="text-sm hover:bg-primary/10 hover:text-primary">
            <Link href="/admin/login">{t("admin.login")}</Link>
          </Button>
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_8px_24px_rgba(214,171,89,0.18)]">
            <Link href="/book">{t("home.cta_book")}</Link>
          </Button>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 transition-colors hover:bg-primary/10 md:hidden"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-primary/15 bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
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
