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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoginPage, setIsLoginPage] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if it's the login page
    if (pathname === "/admin/login") {
      setIsLoginPage(true)
      setIsChecking(false)
      return
    }

    // Check authentication
    const checkAuth = () => {
      const token = localStorage.getItem("adminToken")
      if (!token) {
        router.push("/admin/login")
        setIsAuthenticated(false)
      } else {
        setIsAuthenticated(true)
      }
      setIsChecking(false)
    }

    checkAuth()
  }, [pathname, router])

  // Show loading only briefly while checking
  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/20 rounded-full animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

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
