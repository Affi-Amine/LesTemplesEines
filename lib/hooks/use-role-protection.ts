"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export function useRoleProtection(allowedRoles: string[]) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null) // null = loading/checking

  useEffect(() => {
    const checkAuth = () => {
      const adminUser = localStorage.getItem("adminUser")
      if (!adminUser) {
        router.push("/admin/login")
        return
      }

      try {
        const user = JSON.parse(adminUser)
        if (allowedRoles.includes(user.role)) {
          setIsAuthorized(true)
        } else {
          // Redirect to dashboard if unauthorized
          // Prevent infinite redirect if dashboard is also protected (it shouldn't be for valid roles)
          router.push("/admin") 
        }
      } catch (e) {
        router.push("/admin/login")
      }
    }

    checkAuth()
  }, [router, JSON.stringify(allowedRoles)]) // Stable dependency

  return isAuthorized
}
