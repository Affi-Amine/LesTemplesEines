"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { EmployeeSidebar } from "@/components/employee-sidebar"

export default function EmployeeLayout({
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
  const [isChecking, setIsChecking] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem("adminToken")
        const adminUser = localStorage.getItem("adminUser")
        if (!token) {
          setIsAuthenticated(false)
          router.push("/admin/login")
          return
        }
        if (adminUser) {
          const user = JSON.parse(adminUser)
          setUserRole(user.role)
          if (user.role === 'therapist' || user.role === 'assistant' || user.role === 'manager' || user.role === 'admin') {
            setIsAuthenticated(true)
          } else {
            setIsAuthenticated(false)
            router.push("/admin/login")
          }
        } else {
          setIsAuthenticated(false)
          router.push("/admin/login")
        }
      } catch {
        setIsAuthenticated(false)
        router.push("/admin/login")
      }
    }

    checkAuth()

    const onStorage = (e: StorageEvent) => {
      if (e.key === "adminToken" || e.key === "adminUser") {
        checkAuth()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [pathname, router])

  // No loading gate; compute sync and react to changes

  // Not authenticated - redirect happening
  if (!isAuthenticated) {
    return null
  }

  // Authenticated - show sidebar and content
  return (
    <div className="flex h-screen bg-background">
      <EmployeeSidebar />
      {/* Add top padding on mobile to avoid overlap with fixed mobile menu button */}
      <main className="flex-1 overflow-auto md:ml-64 pt-16 md:pt-0">{children}</main>
    </div>
  )
}
