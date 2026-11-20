"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Gift, Package, Palette } from "lucide-react"

const LINKS = [
  { href: "/admin/gift-cards", label: "Cartes vendues", icon: Gift },
  { href: "/admin/gift-cards/cadeaux-physiques", label: "Cadeaux physiques", icon: Package },
  { href: "/admin/gift-cards/generateur", label: "Générateur de carte", icon: Palette },
]

/** The three gift card screens: sold cards, physical extras and the card design. */
export function GiftCardsSubnav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Sections cartes cadeaux" className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = pathname === link.href
        const Icon = link.icon
        return (
          <Button key={link.href} asChild variant={active ? "default" : "outline"} size="sm">
            <Link href={link.href} aria-current={active ? "page" : undefined}>
              <Icon className="mr-2 h-4 w-4" />
              {link.label}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
