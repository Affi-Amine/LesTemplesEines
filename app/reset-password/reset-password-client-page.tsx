"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { FlowOutcomeHero } from "@/components/flow-outcome-hero"
import { toast } from "sonner"
import { fetchAPI } from "@/lib/api/client"

const PASSWORD_SESSION_STORAGE_KEY = "client-password-session"

function decodeEmailFromToken(token: string | null) {
  if (!token) return ""
  try {
    const payload = token.split(".")[1]
    if (!payload) return ""
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = JSON.parse(window.atob(normalized))
    return typeof decoded.email === "string" ? decoded.email : ""
  } catch {
    return ""
  }
}

export default function ResetPasswordClientPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [isPreparingSession, setIsPreparingSession] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [sessionToken, setSessionToken] = useState("")
  const [sessionError, setSessionError] = useState<string | null>(null)
  const token = searchParams.get("token")
  const hasValidSession = Boolean(sessionToken && !sessionError)
  const passwordError = useMemo(() => {
    if (!password) return null
    if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères."
    return null
  }, [password])
  const confirmPasswordError = useMemo(() => {
    if (!confirmPassword) return null
    if (password !== confirmPassword) return "Les mots de passe ne correspondent pas."
    return null
  }, [confirmPassword, password])

  useEffect(() => {
    let cancelled = false

    const restoreOrRedeemSession = async () => {
      if (!token) {
        setSessionError("Lien invalide ou expiré. Vous pouvez demander un nouveau lien ci-dessous.")
        setIsPreparingSession(false)
        return
      }

      const fallbackEmail = decodeEmailFromToken(token)
      if (fallbackEmail) {
        setEmail(fallbackEmail)
      }

      try {
        const storedRaw = sessionStorage.getItem(PASSWORD_SESSION_STORAGE_KEY)
        if (storedRaw) {
          const stored = JSON.parse(storedRaw) as { originalToken?: string; sessionToken?: string; email?: string }
          if (stored.originalToken === token && stored.sessionToken) {
            if (!cancelled) {
              setSessionToken(stored.sessionToken)
              setEmail(stored.email || fallbackEmail)
              setSessionError(null)
              setIsPreparingSession(false)
            }
            return
          }
        }
      } catch {
        sessionStorage.removeItem(PASSWORD_SESSION_STORAGE_KEY)
      }

      try {
        const result = await fetchAPI<{ session_token: string; email: string }>("/auth/client/password-session", {
          method: "POST",
          body: JSON.stringify({ token }),
        })

        if (cancelled) return

        setSessionToken(result.session_token)
        setEmail(result.email)
        setSessionError(null)
        sessionStorage.setItem(
          PASSWORD_SESSION_STORAGE_KEY,
          JSON.stringify({
            originalToken: token,
            sessionToken: result.session_token,
            email: result.email,
          })
        )
      } catch {
        if (cancelled) return
        setSessionError("Lien invalide ou expiré. Vous pouvez demander un nouveau lien ci-dessous.")
      } finally {
        if (!cancelled) {
          setIsPreparingSession(false)
        }
      }
    }

    restoreOrRedeemSession()

    return () => {
      cancelled = true
    }
  }, [token])

  const handleSendReset = async () => {
    if (!email) {
      toast.error("Renseignez votre email pour recevoir un nouveau lien.")
      return
    }

    try {
      setIsSendingReset(true)
      await fetchAPI("/auth/client/reset-request", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      toast.success("Un nouveau lien a été envoyé.")
    } catch (error: any) {
      toast.error(error.message || "Impossible d'envoyer un nouveau lien.")
    } finally {
      setIsSendingReset(false)
    }
  }

  const handleSubmit = async () => {
    if (!hasValidSession) {
      toast.error("Session invalide ou expirée. Demandez un nouveau lien.")
      return
    }

    if (passwordError || confirmPasswordError) {
      toast.error(passwordError || confirmPasswordError || "Le formulaire contient des erreurs.")
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch("/api/auth/client/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: sessionToken,
          password,
        }),
      })

      const result = await response.json().catch(() => ({ error: "Erreur inconnue" }))

      if (!response.ok) {
        const errorMessage = result.error || "Impossible de mettre à jour le mot de passe."
        if (errorMessage.toLowerCase().includes("expir")) {
          setSessionToken("")
          setSessionError("Votre session de création de mot de passe a expiré. Demandez un nouveau lien ci-dessous.")
          sessionStorage.removeItem(PASSWORD_SESSION_STORAGE_KEY)
        }
        toast.error(errorMessage)
        return
      }

      toast.success("Mot de passe mis à jour.")
      setIsSuccess(true)
      sessionStorage.removeItem(PASSWORD_SESSION_STORAGE_KEY)
    } catch {
      toast.error("Impossible de mettre à jour le mot de passe.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-md mx-auto">
          {isSuccess ? (
            <div className="space-y-6">
              <FlowOutcomeHero
                status="success"
                eyebrow="Mot de passe"
                title="Mot de passe enregistré"
                description="Votre compte est prêt. Vous pouvez maintenant vous connecter à votre espace client."
                helper="Utilisez votre adresse email et votre nouveau mot de passe sur la page de connexion."
              />
              <Card className="p-6">
                <Button className="w-full" onClick={() => router.push("/login")}>
                  Aller à la connexion
                </Button>
              </Card>
            </div>
          ) : (
            <Card className="p-8 space-y-6">
              <div>
                <h1 className="text-3xl font-serif font-bold">Créer mon mot de passe</h1>
                <p className="text-muted-foreground mt-2">Définissez un mot de passe pour accéder à votre espace client.</p>
              </div>

              {isPreparingSession ? (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  Préparation sécurisée de votre session...
                </div>
              ) : null}

              {sessionError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {sessionError}
                </div>
              ) : null}

              {!hasValidSession && !isPreparingSession ? (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">Recevoir un nouveau lien</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Entrez votre email et nous vous renverrons un accès pour créer votre mot de passe.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="client@email.com"
                      disabled={isSendingReset}
                    />
                  </div>
                  <Button className="w-full" variant="outline" onClick={handleSendReset} disabled={isSendingReset}>
                    {isSendingReset ? "Envoi..." : "Recevoir un nouveau lien"}
                  </Button>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!hasValidSession || isLoading || isPreparingSession} />
                <p className="text-sm text-muted-foreground">Mot de passe minimum 8 caractères.</p>
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={!hasValidSession || isLoading || isPreparingSession} />
                {confirmPasswordError && <p className="text-sm text-destructive">{confirmPasswordError}</p>}
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={isLoading || isPreparingSession || !hasValidSession || Boolean(passwordError) || Boolean(confirmPasswordError)}>
                {isLoading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </Card>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
