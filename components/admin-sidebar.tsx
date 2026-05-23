"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, Users, BarChart3, Settings, LogOut, Menu, X, Building2, Scissors, TrendingUp, CalendarDays, UserCheck, Gift, Package, Wallet } from "lucide-react"
import { useState, useEffect } from "react"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  const { t, mounted } = useTranslations()

  useEffect(() => {
    // Get user info from localStorage
    const adminUser = localStorage.getItem("adminUser")
    if (adminUser) {
      setUserInfo(JSON.parse(adminUser))
    }
  }, [])

  const role = userInfo?.role
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const isReceptionist = role === 'receptionist'
  
  // Access control helpers
  const canViewAnalytics = isAdmin
  const canViewSettings = isAdmin || isManager
  const canViewStaff = isAdmin || isManager
  const canViewServices = isAdmin || isManager
  const canSellCounterProducts = isAdmin || isManager || isReceptionist

  const navItems = [
    { href: "/admin", label: mounted ? t("admin.dashboard") : "Dashboard", icon: BarChart3 },
    ...(canViewAnalytics ? [{ href: "/admin/analytics", label: "Analytics", icon: TrendingUp }] : []),
    { href: "/admin/appointments", label: mounted ? t("admin.appointments") : "Appointments", icon: Calendar },
    { href: "/admin/calendrier", label: "Calendrier", icon: CalendarDays },
    { href: "/admin/clients", label: mounted ? t("admin.clients") : "Clients", icon: Users },
    ...(canViewStaff ? [{ href: "/admin/staff", label: mounted ? t("admin.staff") : "Staff", icon: UserCheck }] : []),
    { href: "/admin/salons", label: "Salons", icon: Building2 },
    ...(canViewServices ? [{ href: "/admin/services", label: "Services", icon: Scissors }] : []),
    ...(canSellCounterProducts ? [{ href: "/admin/gift-cards", label: "Cartes cadeaux", icon: Gift }] : []),
    ...(canViewServices ? [{ href: "/admin/packs", label: "Packs", icon: Package }] : []),
    ...(canSellCounterProducts ? [{ href: "/admin/client-packs", label: "Packs clients", icon: Wallet }] : []),
    ...(canViewSettings ? [{ href: "/admin/settings", label: mounted ? t("admin.settings") : "Settings", icon: Settings }] : []),
  ]

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch (e) {
      // Even if API fails, still clear client state
      console.error("Logout API error:", e)
    }

    // Clear local auth state
    try {
      localStorage.removeItem("adminToken")
      localStorage.removeItem("adminUser")
    } catch (e) {
      console.warn("Failed to clear localStorage", e)
    }

    // Close sidebar on mobile and redirect to login
    setIsOpen(false)
    router.push("/admin/login")
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur md:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-primary">Les Temples</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Admin</div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 overflow-y-auto border-r bg-card transition-transform duration-300 md:top-0 md:h-screen md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-primary">Les Temples</h2>
          <p className="text-xs text-muted-foreground">Admin Panel</p>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const IconComponent = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className="w-full justify-start gap-3"
                  onClick={() => setIsOpen(false)}
                >
                  {IconComponent && <IconComponent className="w-4 h-4" />}
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 bg-transparent cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            {mounted ? t("admin.logout") : "Logout"}
          </Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-x-0 bottom-0 top-14 z-30 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
