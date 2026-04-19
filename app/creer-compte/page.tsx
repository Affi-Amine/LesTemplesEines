"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { fetchAPI } from "@/lib/api/client"
import { toast } from "sonner"

export default function CreateAccountPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
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

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Renseignez votre nom et votre email.")
      return
    }

    if (fullNameError || emailError) {
      toast.error(fullNameError || emailError || "Le formulaire contient des erreurs.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchAPI<{ message: string }>("/auth/client/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
        }),
      })

      toast.success(response.message)
      setIsSuccess(true)
    } catch (error: any) {
      toast.error(error.message || "Impossible de préparer le compte.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-md mx-auto">
          <Card className="p-8 space-y-6">
            {isSuccess ? (
              <>
                <div>
                  <h1 className="text-3xl font-serif font-bold">Vérifiez votre boîte mail</h1>
                  <p className="text-muted-foreground mt-2">
                    Nous avons envoyé un lien de création de mot de passe à <span className="font-medium text-foreground">{email.trim()}</span>.
                  </p>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                  Ouvrez le dernier email reçu et cliquez sur le lien pour définir votre mot de passe.
                </div>
                <Button className="w-full" asChild>
                  <Link href="/login">Aller à la connexion</Link>
                </Button>
              </>
            ) : (
              <>
                <div>
                  <h1 className="text-3xl font-serif font-bold">Créer un compte client</h1>
                  <p className="text-muted-foreground mt-2">
                    Nous préparons votre compte puis nous vous envoyons un email pour définir votre mot de passe.
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

                <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || Boolean(fullNameError) || Boolean(emailError)}>
                  {isSubmitting ? "Préparation..." : "Créer mon compte"}
                </Button>

                <p className="text-sm text-muted-foreground">
                  Déjà un compte ? <Link href="/login" className="text-primary">Se connecter</Link>
                </p>
              </>
            )}
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
