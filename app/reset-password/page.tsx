"use client"

import { useState } from "react"
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

  const handleSubmit = async () => {
    if (!password || password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.")
      return
    }

    setIsLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success("Mot de passe mis à jour.")
    router.push("/mes-forfaits")
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

            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
