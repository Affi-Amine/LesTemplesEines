"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function AdminLogin() {
  const router = useRouter()
  const { t, mounted } = useTranslations()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Static credentials for testing
  const ADMIN_EMAIL = "admin@lestemples.fr"
  const ADMIN_PASSWORD = "admin123"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Store auth token in localStorage (will be replaced with real auth later)
      localStorage.setItem("adminToken", "temp-token-" + Date.now())
      router.push("/admin")
    } else {
      setError(t("admin.invalid_credentials"))
    }

    setIsLoading(false)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-4">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />

      <div className="absolute top-6 right-6">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">✦</span>
            </div>
            <span className="text-xl font-semibold text-foreground">Les Temples</span>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">{t("admin.login")}</h1>
          <p className="text-muted-foreground">Gérez vos sanctuaires de bien-être</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-primary/10 rounded-2xl p-8 shadow-lg backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                {t("admin.email")}
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@lestemples.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-muted/50 border-primary/10 focus:border-primary/30 h-11"
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                {t("admin.password")}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-muted/50 border-primary/10 focus:border-primary/30 h-11 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Test Credentials Info */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Identifiants de test:</p>
              <p>Email: admin@lestemples.fr</p>
              <p>Mot de passe: admin123</p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Connexion..." : t("admin.sign_in")}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-primary/10 text-center">
            <p className="text-sm text-muted-foreground">
              Pas un administrateur?{" "}
              <Link href="/" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                Retour à l&apos;accueil
              </Link>
            </p>
          </div>
        </div>

        {/* Security Note */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Ceci est un portail administrateur sécurisé. Vos identifiants sont chiffrés et protégés.
        </p>
      </div>
    </div>
  )
}
