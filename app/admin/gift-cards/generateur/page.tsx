"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AdminHeader } from "@/components/admin-header"
import { GiftCardsSubnav } from "@/components/admin/gift-cards-subnav"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ImageUpload } from "@/components/ui/image-upload"
import { fetchAPI } from "@/lib/api/client"
import { DEFAULT_GIFT_CARD_DESIGN, type GiftCardDesign } from "@/lib/gift-card-design"
import { Download, RefreshCw } from "lucide-react"
import { toast } from "sonner"

type DesignResponse = {
  design: GiftCardDesign
  themes: { key: GiftCardDesign["theme"]; label: string; colors: readonly string[]; accent: string }[]
}

const DEFAULT_SAMPLE = {
  buyerName: "Camille Durand",
  recipientName: "Léa Martin",
  serviceName: "Massage Thaï aux huiles chaudes Solo 1H",
  personalMessage: "Un moment rien que pour toi. Joyeux anniversaire !",
}

/** Edits the card's look with a live render of a sample card; the saved design is used for every card sent. */
export default function GiftCardGeneratorPage() {
  const [design, setDesign] = useState<GiftCardDesign>(DEFAULT_GIFT_CARD_DESIGN)
  const [sample, setSample] = useState(DEFAULT_SAMPLE)
  const [preview, setPreview] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const previewUrl = useRef<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["gift-card-design"],
    queryFn: () => fetchAPI<DesignResponse>("/gift-cards/design"),
  })

  useEffect(() => {
    if (data?.design) setDesign(data.design)
  }, [data])

  // One render per pause in typing; the previous picture stays until the next one lands.
  useEffect(() => {
    if (isLoading) return
    const handle = window.setTimeout(async () => {
      setRendering(true)
      try {
        const response = await fetch("/api/gift-cards/design/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ design, sample }),
          credentials: "same-origin",
        })
        if (!response.ok) throw new Error("Aperçu indisponible")
        const url = URL.createObjectURL(await response.blob())
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
        previewUrl.current = url
        setPreview(url)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Aperçu indisponible")
      } finally {
        setRendering(false)
      }
    }, 500)
    return () => window.clearTimeout(handle)
  }, [design, sample, isLoading])

  const update = <K extends keyof GiftCardDesign>(key: K, value: GiftCardDesign[K]) => {
    setDesign((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  const save = async () => {
    try {
      setSaving(true)
      const result = await fetchAPI<{ design: GiftCardDesign }>("/gift-cards/design", { method: "PUT", body: JSON.stringify(design) })
      setDesign(result.design)
      setDirty(false)
      toast.success("Design enregistré : il s'applique aux prochaines cartes envoyées et téléchargées.")
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer le design.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Générateur de carte cadeau" description="Le visuel envoyé par email aux clients et téléchargeable pour chaque carte vendue" />
      <div className="space-y-4 p-3 sm:p-6 md:space-y-6">
        <GiftCardsSubnav />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <Card className="overflow-hidden p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Aperçu</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {rendering && <><RefreshCw className="h-4 w-4 animate-spin" />Rendu…</>}
                  {preview && <Button asChild variant="outline" size="sm"><a href={preview} download="apercu-carte-cadeau.png"><Download className="mr-2 h-4 w-4" />Télécharger l&apos;aperçu</a></Button>}
                </div>
              </div>
              <div className="aspect-[14/9] w-full overflow-hidden rounded-xl bg-muted">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Aperçu de la carte cadeau" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Génération de l&apos;aperçu…</div>
                )}
              </div>
            </Card>

            <Card className="space-y-4 p-4 sm:p-6">
              <h2 className="text-lg font-semibold">Exemple affiché</h2>
              <p className="text-sm text-muted-foreground">Ces valeurs servent uniquement à l&apos;aperçu : chaque carte vendue reprend les vraies informations de l&apos;achat.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="sample-buyer">Offert par</Label><Input id="sample-buyer" value={sample.buyerName} onChange={(e) => setSample({ ...sample, buyerName: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="sample-recipient">Pour</Label><Input id="sample-recipient" value={sample.recipientName} onChange={(e) => setSample({ ...sample, recipientName: e.target.value })} /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="sample-service">Prestation</Label><Input id="sample-service" value={sample.serviceName} onChange={(e) => setSample({ ...sample, serviceName: e.target.value })} /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="sample-message">Message</Label><Textarea id="sample-message" rows={2} value={sample.personalMessage} onChange={(e) => setSample({ ...sample, personalMessage: e.target.value })} /></div>
              </div>
            </Card>
          </div>

          <Card className="space-y-5 p-4 sm:p-6 xl:sticky xl:top-6 xl:self-start">
            <h2 className="text-lg font-semibold">Design</h2>

            <div className="space-y-2">
              <Label>Thème</Label>
              <div className="grid grid-cols-3 gap-2">
                {(data?.themes || []).map((theme) => (
                  <button key={theme.key} type="button" onClick={() => update("theme", theme.key)} aria-pressed={design.theme === theme.key}
                    className={`rounded-lg border p-2 text-left text-sm transition ${design.theme === theme.key ? "border-primary ring-1 ring-primary" : "hover:bg-muted/40"}`}>
                    <span className="mb-2 block h-8 w-full rounded" style={{ background: `linear-gradient(120deg, ${theme.colors[0]}, ${theme.colors[1]}, ${theme.colors[2]})`, border: `1px solid ${theme.accent}` }} />
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2"><Label htmlFor="design-title">Titre</Label><Input id="design-title" maxLength={40} value={design.title} onChange={(e) => update("title", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="design-tagline">Sous-titre</Label><Input id="design-tagline" maxLength={80} value={design.tagline} onChange={(e) => update("tagline", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="design-footer">Mention en bas de carte</Label><Textarea id="design-footer" rows={2} maxLength={160} value={design.footer_note} onChange={(e) => update("footer_note", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="design-signature">Signature</Label><Input id="design-signature" maxLength={60} value={design.signature} onChange={(e) => update("signature", e.target.value)} /></div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm font-medium">Logo<Switch checked={design.show_logo} onCheckedChange={(checked) => update("show_logo", checked)} /></label>
              <div className="space-y-2">
                <Label htmlFor="design-validity">Validité (mois)</Label>
                <Input id="design-validity" type="number" min={1} max={60} placeholder="Illimitée" value={design.validity_months ?? ""} onChange={(e) => update("validity_months", e.target.value ? Math.min(60, Math.max(1, Number(e.target.value))) : null)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Photo de fond (optionnelle)</Label>
              <ImageUpload value={design.background_image_url || ""} onChange={(url) => update("background_image_url", url || null)} bucketName="service-images" />
              <p className="text-xs text-muted-foreground">La photo est assombrie (ou éclaircie sur le thème Ivoire) pour garder le texte lisible.</p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving || !dirty}>{saving ? "Enregistrement…" : "Enregistrer le design"}</Button>
              {dirty && <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
