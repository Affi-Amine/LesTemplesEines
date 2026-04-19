"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { t, mounted } = useTranslations()

  if (!mounted) return null

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/72 backdrop-blur-xl border-b border-primary/15 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-gradient-to-br from-primary via-primary to-primary/70 rounded-lg flex items-center justify-center shadow-[0_0_24px_rgba(214,171,89,0.22)]">
            <span className="text-primary-foreground font-bold text-lg">✦</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-foreground tracking-tight group-hover:text-primary">Les Temples</span>
            <span className="text-xs text-primary/80">Bien-être thaïlandais</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="/gift" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Cartes cadeaux
          </Link>
          <Link href="/forfaits" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Forfaits
          </Link>
          <Link href="/mes-forfaits" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Mes forfaits
          </Link>
          <Link href="/jai-une-carte-cadeau" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            J&apos;ai une carte cadeau
          </Link>
          <Link href="#services" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {t("nav.salons")}
          </Link>
          <Link href="#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Contact
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="text-sm hover:bg-primary/10 hover:text-primary">
            <Link href="/admin/login">{t("admin.login")}</Link>
          </Button>
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_8px_24px_rgba(214,171,89,0.18)]">
            <Link href="/book">{t("home.cta_book")}</Link>
          </Button>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 hover:bg-primary/10 rounded-lg transition-colors"
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-primary/15 bg-background/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
            <Link href="/gift" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cartes cadeaux
            </Link>
            <Link href="/forfaits" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Forfaits
            </Link>
            <Link href="/mes-forfaits" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Mes forfaits
            </Link>
            <Link href="/jai-une-carte-cadeau" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              J&apos;ai une carte cadeau
            </Link>
            <Link href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.salons")}
            </Link>
            <Link href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
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
