"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, Users, BarChart3, Settings, LogOut, Menu, X } from "lucide-react"
import { useState } from "react"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AdminSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { t, mounted } = useTranslations()

  const navItems = [
    { href: "/admin", label: t("admin.dashboard"), icon: BarChart3 },
    { href: "/admin/appointments", label: t("admin.appointments"), icon: Calendar },
    { href: "/admin/clients", label: t("admin.clients"), icon: Users },
    { href: "/admin/staff", label: t("admin.staff"), icon: Users },
    { href: "/admin/settings", label: t("admin.settings"), icon: Settings },
  ]

  if (!mounted) {
    return null
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)} className="bg-card">
          {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-card border-r transition-transform duration-300 z-40 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-primary">Les Temples</h2>
          <p className="text-xs text-muted-foreground">Admin Panel</p>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className="w-full justify-start gap-3"
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <Button variant="outline" className="w-full justify-start gap-3 bg-transparent">
            <LogOut className="w-4 h-4" />
            {t("admin.logout")}
          </Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
