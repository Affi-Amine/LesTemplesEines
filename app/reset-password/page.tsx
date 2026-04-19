"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
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
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const token = searchParams.get("token")
  const sessionError = useMemo(() => {
    if (!token) {
      return "Lien invalide ou expiré. Demandez un nouveau lien."
    }
    return null
  }, [token])
  const hasValidSession = Boolean(token && !sessionError)

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
      router.push("/login")
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

            {sessionError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {sessionError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!hasValidSession || isLoading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={!hasValidSession || isLoading} />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isLoading || !hasValidSession}>
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
