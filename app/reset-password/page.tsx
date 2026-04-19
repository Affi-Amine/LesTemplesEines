"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function validateRecoverySession() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
        const errorCode = hashParams.get("error_code")
        const errorDescription = hashParams.get("error_description")

        if (errorCode) {
          if (!isMounted) return
          setHasValidSession(false)
          setSessionError(decodeURIComponent(errorDescription || "Lien invalide ou expiré."))
          setIsCheckingSession(false)
          return
        }

        const { data, error } = await supabase.auth.getUser()

        if (!isMounted) return

        if (error || !data.user) {
          setHasValidSession(false)
          setSessionError("Lien invalide ou expiré. Demandez un nouveau lien de création de mot de passe.")
          setIsCheckingSession(false)
          return
        }

        setHasValidSession(true)
        setSessionError(null)
        setIsCheckingSession(false)
      } catch {
        if (!isMounted) return
        setHasValidSession(false)
        setSessionError("Impossible de valider le lien. Demandez un nouveau lien.")
        setIsCheckingSession(false)
      }
    }

    validateRecoverySession()

    return () => {
      isMounted = false
    }
  }, [supabase.auth])

  const handleSubmit = async () => {
    if (!hasValidSession) {
      toast.error("Lien invalide ou expiré. Demandez un nouveau lien.")
      return
    }

    if (!password || password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.")
      return
    }

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Mot de passe mis à jour.")
      router.push("/mes-forfaits")
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
          <Card className="p-8 space-y-6">
            <div>
              <h1 className="text-3xl font-serif font-bold">Créer mon mot de passe</h1>
              <p className="text-muted-foreground mt-2">Définissez un mot de passe pour accéder à votre espace client.</p>
            </div>

            {isCheckingSession ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Vérification du lien sécurisé...
              </div>
            ) : sessionError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {sessionError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isCheckingSession || !hasValidSession || isLoading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isCheckingSession || !hasValidSession || isLoading} />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isLoading || isCheckingSession || !hasValidSession}>
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
