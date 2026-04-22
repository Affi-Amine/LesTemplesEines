"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { FlowOutcomeHero } from "@/components/flow-outcome-hero"
import { fetchAPI } from "@/lib/api/client"
import { toast } from "sonner"

export default function CreateAccountPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const fullNameError = useMemo(() => {
    if (!fullName) return null
    if (fullName.trim().length < 2) return "Le nom doit contenir au moins 2 caractères."
    return null
  }, [fullName])

  const emailError = useMemo(() => {
    if (!email) return null
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Renseignez une adresse email valide."
    return null
  }, [email])

  const passwordError = useMemo(() => {
    if (!password) return null
    if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères."
    return null
  }, [password])

  const confirmPasswordError = useMemo(() => {
    if (!confirmPassword) return null
    if (confirmPassword !== password) return "Les mots de passe ne correspondent pas."
    return null
  }, [confirmPassword, password])

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error("Renseignez votre nom, votre email et votre mot de passe.")
      return
    }

    if (fullNameError || emailError || passwordError || confirmPasswordError) {
      toast.error(fullNameError || emailError || passwordError || confirmPasswordError || "Le formulaire contient des erreurs.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchAPI<{ message: string }>("/auth/client/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
        }),
      })

      toast.success(response.message)
      setIsSuccess(true)
    } catch (error: any) {
      toast.error(error.message || "Impossible de créer le compte.")
    } finally {
      setIsSubmitting(false)
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
                eyebrow="Compte client"
                title="Compte créé"
                description={`Votre compte client est prêt pour ${email.trim()}.`}
                helper="Vous pouvez maintenant vous connecter immédiatement avec votre email et votre mot de passe."
              />
              <Card className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Votre accès client est actif. Vous retrouverez vos forfaits et vos prochaines réservations après connexion.
                </p>
                <Button className="w-full" onClick={() => router.push("/login")}>
                  Aller à la connexion
                </Button>
              </Card>
            </div>
          ) : (
            <Card className="p-8 space-y-6">
              <div>
                <h1 className="text-3xl font-serif font-bold">Créer un compte client</h1>
                <p className="text-muted-foreground mt-2">
                  Créez votre compte et choisissez votre mot de passe tout de suite.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Prénom Nom" />
                {fullNameError && <p className="text-sm text-destructive">{fullNameError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" />
                {emailError && <p className="text-sm text-destructive">{emailError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 caractères" />
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmez votre mot de passe" />
                {confirmPasswordError && <p className="text-sm text-destructive">{confirmPasswordError}</p>}
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || Boolean(fullNameError) || Boolean(emailError) || Boolean(passwordError) || Boolean(confirmPasswordError)}>
                {isSubmitting ? "Création..." : "Créer mon compte"}
              </Button>

              <p className="text-sm text-muted-foreground">
                Déjà un compte ? <Link href="/login" className="text-primary">Se connecter</Link>
              </p>
            </Card>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
