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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return Boolean(localStorage.getItem("adminToken"))
    } catch {
      return false
    }
  })
  const [isLoginPage, setIsLoginPage] = useState(() => pathname === "/admin/login")
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    setIsLoginPage(pathname === "/admin/login")

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

    const onStorage = (e: StorageEvent) => {
      if (e.key === "adminToken") {
        checkAuth()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [pathname, router])

  // No loading gate here; compute sync and react to changes

  // Login page - no sidebar
  if (isLoginPage) {
    return <>{children}</>
  }

  // Not authenticated and not login page - redirect happening
  if (!isAuthenticated) {
    return null
  }

  // Authenticated - show sidebar and content
  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto md:ml-64">{children}</main>
    </div>
  )
}
