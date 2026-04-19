"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { FlowOutcomeHero } from "@/components/flow-outcome-hero"
import { toast } from "sonner"

export default function ResetPasswordClientPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const token = searchParams.get("token")
  const sessionError = useMemo(() => {
    if (!token) {
      return "Lien invalide ou expiré. Demandez un nouveau lien."
    }
    return null
  }, [token])
  const hasValidSession = Boolean(token && !sessionError)
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

  const handleSubmit = async () => {
    if (!hasValidSession) {
      toast.error("Lien invalide ou expiré. Demandez un nouveau lien.")
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
          token,
          password,
        }),
      })

      const result = await response.json().catch(() => ({ error: "Erreur inconnue" }))

      if (!response.ok) {
        toast.error(result.error || "Impossible de mettre à jour le mot de passe.")
        return
      }

      toast.success("Mot de passe mis à jour.")
      setIsSuccess(true)
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

              {sessionError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {sessionError}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!hasValidSession || isLoading} />
                <p className="text-sm text-muted-foreground">Mot de passe minimum 8 caractères.</p>
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={!hasValidSession || isLoading} />
                {confirmPasswordError && <p className="text-sm text-destructive">{confirmPasswordError}</p>}
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={isLoading || !hasValidSession || Boolean(passwordError) || Boolean(confirmPasswordError)}>
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
