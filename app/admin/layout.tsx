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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoginPage, setIsLoginPage] = useState(false)

  useEffect(() => {
    if (pathname === "/admin/login") {
      setIsLoginPage(true)
      setIsAuthenticated(true)
      return
    }

    const token = localStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
      setIsAuthenticated(false)
    } else {
      setIsAuthenticated(true)
    }
  }, [pathname, router])

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/20 rounded-full animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto md:ml-64">{children}</main>
    </div>
  )
}
