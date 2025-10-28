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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    // Check authentication and role
    const checkAuth = () => {
      const token = localStorage.getItem("adminToken")
      const adminUser = localStorage.getItem("adminUser")
      
      if (!token) {
        router.push("/admin/login")
        setIsAuthenticated(false)
        setIsChecking(false)
        return
      }

      if (adminUser) {
        const user = JSON.parse(adminUser)
        setUserRole(user.role)
        
        // Check if user has access to employee dashboard
        if (user.role === 'therapist' || user.role === 'assistant' || user.role === 'manager' || user.role === 'admin') {
          setIsAuthenticated(true)
        } else {
          // Redirect unauthorized users to login
          router.push("/admin/login")
          setIsAuthenticated(false)
        }
      } else {
        router.push("/admin/login")
        setIsAuthenticated(false)
      }
      
      setIsChecking(false)
    }

    checkAuth()
  }, [pathname, router])

  // Show loading while checking authentication
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

  // Not authenticated - redirect happening
  if (!isAuthenticated) {
    return null
  }

  // Authenticated - show sidebar and content
  return (
    <div className="flex h-screen bg-background">
      <EmployeeSidebar />
      <main className="flex-1 overflow-auto md:ml-64">{children}</main>
    </div>
  )
}