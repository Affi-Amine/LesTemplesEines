"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, Users, BarChart3, Settings, LogOut, Menu, X, Building2, Scissors, TrendingUp, CalendarDays, UserCheck, Gift, Package, Wallet } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [userInfo, setUserInfo] = useState<any>(null)
  const { t, mounted } = useTranslations()

  useEffect(() => { setIsOpen(false) }, [pathname])

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1536px)")
    const closeOnDesktop = () => { if (desktop.matches) setIsOpen(false) }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  useEffect(() => {
    // Get user info from localStorage
    try {
      const adminUser = localStorage.getItem("adminUser")
      if (adminUser) setUserInfo(JSON.parse(adminUser))
    } catch { setUserInfo(null) }
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
    { href: "/admin/calendrier", label: "Agenda", icon: CalendarDays },
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

  const navigation = (
    <div className="flex min-h-full flex-col">
      <div className="border-b p-5">
        <p className="text-xl font-bold text-primary">Les Temples</p>
        <p className="mt-1 text-xs text-muted-foreground">Espace de gestion</p>
      </div>
      <nav aria-label="Navigation administration" className="flex-1 space-y-1 p-3">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
          const IconComponent = item.icon
          return <Button key={item.href} asChild variant={isActive ? "default" : "ghost"} className="min-h-12 w-full justify-start gap-3 px-4">
            <Link href={item.href} onClick={() => setIsOpen(false)} aria-current={isActive ? "page" : undefined}>
              <IconComponent className="h-5 w-5" />{item.label}
            </Link>
          </Button>
        })}
      </nav>
      <div className="border-t p-3">
        <Button variant="outline" className="min-h-12 w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />{mounted ? t("admin.logout") : "Déconnexion"}
        </Button>
      </div>
    </div>
  )

  const currentSalonPath = pathname.match(/^\/admin\/salons\/[^/]+\/dashboard/)?.[0]
  const shortcuts = [
    { href: currentSalonPath || "/admin/calendrier", label: "Agenda", icon: CalendarDays },
    { href: "/admin/salons", label: "Salons", icon: Building2 },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/appointments", label: "RDV", icon: Calendar },
  ]

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b bg-card px-4 2xl:hidden">
        <Button
          ref={menuButton}
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-12 w-12 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-primary">Les Temples</div>
          <div className="truncate text-sm text-muted-foreground">{currentSalonPath ? "Agenda" : navItems.find(item => item.href !== "/admin" && pathname.startsWith(item.href))?.label || "Administration"}</div>
        </div>
      </div>

      <nav aria-label="Accès rapides" className="fixed bottom-0 left-0 top-16 z-30 hidden w-20 flex-col gap-2 border-r bg-card px-2 py-3 md:flex 2xl:hidden">
        {shortcuts.map(item => <Link key={item.label} href={item.href} aria-current={pathname === item.href ? "page" : undefined}
          className={`flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-[11px] font-medium active:bg-primary/15 ${pathname === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
          <item.icon className="h-5 w-5" />{item.label}
        </Link>)}
      </nav>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); menuButton.current?.focus({ preventScroll: true }) }} overlayClassName="data-[state=open]:animate-none data-[state=closed]:animate-none" className="inset-y-0 left-0 top-0 z-[60] h-dvh max-h-dvh w-[min(320px,calc(100vw-3rem))] max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0 data-[state=open]:animate-none data-[state=closed]:animate-none sm:max-w-none sm:p-0" >
          <DialogTitle className="sr-only">Menu de l’administration</DialogTitle>
          <DialogDescription className="sr-only">Choisissez la rubrique à ouvrir.</DialogDescription>
          {navigation}
        </DialogContent>
      </Dialog>
      {/* Desktop navigation stays in its own scroll area; logout follows links. */}
      <aside
        className="fixed inset-y-0 left-0 hidden h-dvh w-64 overflow-y-auto border-r bg-card 2xl:block"
      >
        {navigation}
      </aside>

    </>
  )
}
