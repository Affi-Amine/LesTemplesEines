"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AdminSidebar } from "@/components/admin-sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const isLoginPage = pathname === "/admin/login"
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {

    const checkAuth = () => {
      try {
        const token = localStorage.getItem("adminToken")
        if (!token) {
          setIsAuthenticated(false)
          router.push("/admin/login")
        } else {
          setIsAuthenticated(true)
        }
      } catch {
        setIsAuthenticated(false)
      }
    }

    checkAuth()
    setIsChecking(false)

    const onStorage = (e: StorageEvent) => {
      if (e.key === "adminToken") {
        checkAuth()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [pathname, router])

  // Keep the server and first client render identical; then restore the session.

  // Login page - no sidebar
  if (isLoginPage) {
    return <>{children}</>
  }

  if (isChecking) return <div role="status" className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Chargement de votre espace…</div>

  // Not authenticated and not login page - redirect happening
  if (!isAuthenticated) {
    return null
  }

  // Authenticated - show sidebar and content
  return (
    <div data-admin-shell className="min-h-dvh bg-background">
      <AdminSidebar />
      <main id="admin-content" className="min-w-0 pt-16 md:ml-20 2xl:ml-64 2xl:pt-0">{children}</main>
    </div>
  )
}
