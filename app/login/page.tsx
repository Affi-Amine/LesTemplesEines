"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/client"
import { fetchAPI } from "@/lib/api/client"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setIsLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    router.push("/mes-forfaits")
    router.refresh()
  }

  const handleReset = async () => {
    if (!email) {
      toast.error("Renseignez votre email d'abord.")
      return
    }

    setIsSendingReset(true)
    try {
      await fetchAPI("/auth/client/reset-request", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      toast.success("Email de réinitialisation envoyé.")
    } catch (error: any) {
      toast.error(error.message || "Impossible d'envoyer l'email.")
    } finally {
      setIsSendingReset(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-md mx-auto">
          <Card className="p-8 space-y-6">
            <div>
              <h1 className="text-3xl font-serif font-bold">Connexion client</h1>
              <p className="text-muted-foreground mt-2">Accédez à vos forfaits et réservations.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <Button className="w-full" onClick={handleLogin} disabled={isLoading}>
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>

            <Button variant="outline" className="w-full" onClick={handleReset} disabled={isSendingReset}>
              {isSendingReset ? "Envoi..." : "Recevoir un lien de réinitialisation"}
            </Button>

            <p className="text-sm text-muted-foreground">
              Pas encore de compte ? <Link href="/creer-compte" className="text-primary">Créer un compte</Link> ou achetez un forfait sur <Link href="/forfaits" className="text-primary">/forfaits</Link>.
            </p>
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
