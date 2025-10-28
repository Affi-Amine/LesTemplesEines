"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, User, Clock, LogOut, Menu, X, Home } from "lucide-react"
import { useState, useEffect } from "react"
import { useTranslations } from "@/lib/i18n/use-translations"

export function EmployeeSidebar() {
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

  const navItems = [
    { href: "/employee", label: "Tableau de bord", icon: Home },
    { href: "/employee/calendar", label: "Calendrier", icon: Calendar },
    { href: "/employee/profile", label: "Profil", icon: User },
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
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background/80 backdrop-blur-sm border-primary/20"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-card border-r border-primary/10 z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-primary/10">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">✦</span>
              </div>
              <span className="font-semibold text-foreground">Les Temples</span>
            </Link>
            {userInfo && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                <p className="text-sm font-medium text-foreground">
                  {userInfo.first_name} {userInfo.last_name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {userInfo.role}
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-primary/10">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Déconnexion
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}