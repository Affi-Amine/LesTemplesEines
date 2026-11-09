"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Download, Lock, Mail, Save, Settings2 } from "lucide-react"
import { toast } from "sonner"

import { AdminHeader } from "@/components/admin-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { fetchAPI } from "@/lib/api/client"
import { activityRecap, SOURCE_LABELS, sumAmounts, VOUCHER_LABELS, type CashSheet, type CashSheetClosure, type CashSheetSettings } from "@/lib/cash-sheet/types"
import { useRoleProtection } from "@/lib/hooks/use-role-protection"

type SettingsResponse = {
  salons: { salon: { id: string; name: string; city: string; email: string | null }; settings: CashSheetSettings }[]
  emailEnabled: boolean
  cronConfigured: boolean
}
type SheetResponse = { sheet: CashSheet; closure: CashSheetClosure | null }

const SETTINGS_KEY = ["admin", "cash-sheet", "settings"]

function euros(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function parisToday() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}

function formatStamp(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso))
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inattendue"
}

function SheetTable({ sheet }: { sheet: CashSheet }) {
  const money = (cents: number) => (cents ? euros(cents) : "")
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-2 font-medium">Temps</th>
            <th className="px-2 py-2 font-medium">Client</th>
            <th className="px-2 py-2 font-medium">Prestation</th>
            <th className="px-2 py-2 text-right font-medium">CB</th>
            <th className="px-2 py-2 text-right font-medium">Esp.</th>
            <th className="px-2 py-2 text-right font-medium">T/W</th>
            <th className="px-2 py-2 text-right font-medium">En ligne</th>
            <th className="px-2 py-2 text-right font-medium">Autre</th>
            <th className="px-2 py-2 font-medium">CC / Abo.</th>
            <th className="px-2 py-2 font-medium">Masseuse</th>
            <th className="px-2 py-2 text-right font-medium">Heure</th>
          </tr>
        </thead>
        <tbody>
          {sheet.lines.length === 0 && (
            <tr><td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">Aucune prestation enregistrée ce jour.</td></tr>
          )}
          {sheet.lines.map((line) => (
            <tr key={line.appointmentId} className={`border-t ${line.status !== "paid" ? "text-muted-foreground italic" : ""}`}>
              <td className="px-2 py-1.5 whitespace-nowrap">{line.time}</td>
              <td className="px-2 py-1.5">
                {line.client}
                {line.status === "no_show" && <Badge variant="outline" className="ml-2">absent</Badge>}
                {line.status === "unpaid" && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700">non réglé</Badge>}
                {line.status === "partial" && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700">partiellement réglé</Badge>}
              </td>
              <td className="px-2 py-1.5">{line.service}
                <span className="block text-xs text-muted-foreground">{SOURCE_LABELS[line.source || "unknown"]}{line.prestationCount ? ` · ${line.prestationCount} prestation(s)` : ""}</span>
              </td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">{money(line.amounts.card)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">{money(line.amounts.cash)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">{money(line.amounts.treatwell)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">{money(line.amounts.online)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">{money(line.amounts.other)}</td>
              <td className="px-2 py-1.5">{line.vouchers.map((v) => VOUCHER_LABELS[v]).join(", ")}</td>
              <td className="px-2 py-1.5">{line.staff}</td>
              <td className="px-2 py-1.5 text-right">{line.duration}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 bg-muted/40 font-semibold">
          <tr>
            <td colSpan={3} className="px-2 py-2">TOTAL JOURNÉE</td>
            <td className="px-2 py-2 text-right whitespace-nowrap">{euros(sheet.totals.card)}</td>
            <td className="px-2 py-2 text-right whitespace-nowrap">{euros(sheet.totals.cash)}</td>
            <td className="px-2 py-2 text-right whitespace-nowrap">{euros(sheet.totals.treatwell)}</td>
            <td className="px-2 py-2 text-right whitespace-nowrap">{euros(sheet.totals.online)}</td>
            <td className="px-2 py-2 text-right whitespace-nowrap">{euros(sheet.totals.other)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Recap({ sheet }: { sheet: CashSheet }) {
  const rows: [string, string, boolean?][] = [
    ...activityRecap(sheet),
    ["Carte bancaire (CB)", euros(sheet.totals.card)],
    ["Espèces", euros(sheet.totals.cash)],
    ["Total caisse (CB + espèces)", euros(sheet.totals.card + sheet.totals.cash), true],
    ["Paiement en ligne", euros(sheet.totals.online)],
    ["Paiements Treatwell enregistrés", euros(sheet.totals.treatwell)],
    ["Autres moyens", euros(sheet.totals.other)],
    ["Total général", euros(sumAmounts(sheet.totals)), true],
    ["Cartes cadeaux utilisées", String(sheet.counts.giftCards)],
    ["Forfaits utilisés", String(sheet.counts.packs)],
    ["Cartes tampon utilisées", String(sheet.counts.stamps)],
    ["Lignes enregistrées", String(sheet.counts.lines)],
    ["Absences (no show)", `${sheet.counts.noShows} · ${euros(sheet.noShowAmountCents)} non encaissés`],
    ["Non réglées", `${sheet.counts.unpaid} · ${euros(sheet.unpaidAmountCents)}`],
    ...(sheet.activity ? [["Solde restant dû (hors absences)", euros(sheet.activity.outstandingCents)] as [string, string]] : []),
  ]
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([label, value, bold]) => (
        <div key={label} className={`flex items-center justify-between gap-3 px-3 py-1.5 ${bold ? "bg-muted/50 font-semibold" : ""}`}>
          <dt>{label}</dt>
          <dd className="whitespace-nowrap">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function SettingsCard({ data, isAdmin }: { data: SettingsResponse; isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, CashSheetSettings & { recipientsText: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setDrafts(Object.fromEntries(data.salons.map(({ settings }) => [settings.salon_id, { ...settings, recipientsText: settings.recipients.join(", ") }])))
  }, [data])

  const update = (salonId: string, patch: Partial<CashSheetSettings & { recipientsText: string }>) =>
    setDrafts((prev) => ({ ...prev, [salonId]: { ...prev[salonId], ...patch } }))

  const save = async (salonId: string) => {
    const draft = drafts[salonId]
    if (!draft) return
    setBusy(salonId)
    try {
      await fetchAPI("/admin/cash-sheet/settings", {
        method: "PUT",
        body: JSON.stringify({
          salon_id: salonId,
          auto_enabled: draft.auto_enabled,
          send_time: draft.send_time,
          recipients: draft.recipientsText.split(/[,;\s]+/).map((r) => r.trim()).filter(Boolean),
          signer_name: draft.signer_name,
        }),
      })
      toast.success("Paramètres enregistrés")
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Clôture automatique</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Désactivée par défaut. Une fois activée pour un salon, la feuille est clôturée et envoyée chaque jour à l'heure indiquée (heure de Paris), signée du nom du responsable ci-dessous. Une heure avant 05:00 clôture la veille.
        {!data.cronConfigured && <span className="block text-destructive">CRON_SECRET absent sur ce déploiement : la tâche planifiée ne peut pas tourner.</span>}
        {!data.emailEnabled && <span className="block text-amber-700">Envoi d'e-mails désactivé sur ce déploiement (RESEND_API_KEY) : les clôtures seront enregistrées mais pas envoyées.</span>}
      </p>
      <div className="mt-4 divide-y">
        {data.salons.map(({ salon, settings }) => {
          const draft = drafts[salon.id] || { ...settings, recipientsText: settings.recipients.join(", ") }
          return (
            <div key={salon.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto_auto] md:items-start">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{salon.name}</span>
                  <span className="text-sm text-muted-foreground">{salon.city}</span>
                  {settings.auto_enabled ? <Badge className="bg-emerald-600 text-white">Automatique à {settings.send_time}</Badge> : <Badge variant="outline">Manuel</Badge>}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor={`signer-${salon.id}`}>Responsable (signature)</Label>
                    <Input id={`signer-${salon.id}`} value={draft.signer_name} onChange={(e) => update(salon.id, { signer_name: e.target.value })} disabled={!isAdmin} className="mt-1" placeholder="Prénom du responsable" />
                  </div>
                  <div>
                    <Label htmlFor={`time-${salon.id}`}>Heure de clôture</Label>
                    <Input id={`time-${salon.id}`} type="time" value={draft.send_time} onChange={(e) => update(salon.id, { send_time: e.target.value })} disabled={!isAdmin} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor={`to-${salon.id}`}>Destinataires</Label>
                    <Input id={`to-${salon.id}`} value={draft.recipientsText} onChange={(e) => update(salon.id, { recipientsText: e.target.value })} disabled={!isAdmin} className="mt-1" placeholder={salon.email || "email@exemple.fr"} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Sans destinataire, la feuille part à l'adresse du salon{salon.email ? ` (${salon.email})` : ""}. Plusieurs adresses séparées par des virgules.</p>
              </div>
              <label className="flex items-center gap-2 text-sm md:pt-7">
                <Switch checked={draft.auto_enabled} onCheckedChange={(checked) => update(salon.id, { auto_enabled: checked })} disabled={!isAdmin} aria-label={`Clôture automatique ${salon.name}`} />
                Automatique
              </label>
              {isAdmin && (
                <Button onClick={() => save(salon.id)} disabled={busy === salon.id} className="md:mt-6">
                  <Save className="mr-2 h-4 w-4" />{busy === salon.id ? "Enregistrement…" : "Enregistrer"}
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {!isAdmin && <p className="mt-2 text-xs text-muted-foreground">Seul un administrateur peut modifier ces paramètres.</p>}
    </Card>
  )
}

export default function CaissePage() {
  const isAuthorized = useRoleProtection(["admin", "manager"])
  const queryClient = useQueryClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [salonId, setSalonId] = useState("")
  const [date, setDate] = useState(parisToday)
  const [signer, setSigner] = useState("")
  const [signerTouched, setSignerTouched] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("adminUser") || "null")
      setIsAdmin(user?.role === "admin")
      if (user?.salon_id && user.role === "manager") setSalonId((current) => current || user.salon_id)
    } catch { setIsAdmin(false) }
  }, [])

  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => fetchAPI<SettingsResponse>("/admin/cash-sheet/settings"), enabled: Boolean(isAuthorized) })
  useEffect(() => {
    if (!salonId && settings.data?.salons[0]) setSalonId(settings.data.salons[0].salon.id)
  }, [settings.data, salonId])

  const current = useMemo(() => settings.data?.salons.find((s) => s.salon.id === salonId), [settings.data, salonId])
  useEffect(() => {
    if (!signerTouched && current) setSigner(current.settings.signer_name)
  }, [current, signerTouched])

  const sheetKey = ["admin", "cash-sheet", salonId, date]
  const sheet = useQuery({ queryKey: sheetKey, queryFn: () => fetchAPI<SheetResponse>(`/admin/cash-sheet?salon_id=${salonId}&date=${date}`), enabled: Boolean(isAuthorized && salonId && date) })

  if (!isAuthorized) return null
  const data = sheet.data
  const closed = Boolean(data?.closure)
  const pdfUrl = `/api/admin/cash-sheet/pdf?salon_id=${salonId}&date=${date}`

  const close = async (send: boolean) => {
    if (!window.confirm(`Clôturer la journée du ${date} pour ${current?.salon.name || "ce salon"} ? Les montants seront figés et ne pourront plus être modifiés.${send ? " La feuille sera envoyée par e-mail." : ""}`)) return
    setBusy(send ? "close-send" : "close")
    try {
      const result = await fetchAPI<{ sent: { to: string[] } | { skipped: string } }>("/admin/cash-sheet/close", { method: "POST", body: JSON.stringify({ salon_id: salonId, date, signer_name: signer, send }) })
      if ("to" in result.sent) toast.success(`Journée clôturée et envoyée à ${result.sent.to.join(", ")}`)
      else if (send) toast.warning(`Journée clôturée, mais non envoyée : ${result.sent.skipped}`)
      else toast.success("Journée clôturée")
      queryClient.invalidateQueries({ queryKey: sheetKey })
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  const resend = async () => {
    setBusy("send")
    try {
      const result = await fetchAPI<{ sent: { to: string[] } }>("/admin/cash-sheet/close", { method: "PUT", body: JSON.stringify({ salon_id: salonId, date }) })
      toast.success(`Feuille envoyée à ${result.sent.to.join(", ")}`)
      queryClient.invalidateQueries({ queryKey: sheetKey })
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Feuille de caisse" description="Récapitulatif journalier des prestations et des encaissements, par salon" />

      <div className="max-w-6xl space-y-4 p-3 sm:p-6 md:space-y-6">
        <Card className="p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div>
              <Label htmlFor="sheet-salon">Salon</Label>
              <select id="sheet-salon" value={salonId} onChange={(e) => { setSalonId(e.target.value); setSignerTouched(false) }} className="mt-1 block h-10 w-full rounded-lg border bg-card px-3 text-sm">
                {(settings.data?.salons || []).map(({ salon }) => <option key={salon.id} value={salon.id}>{salon.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="sheet-date">Date</Label>
              <Input id="sheet-date" type="date" value={date} max={parisToday()} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="sheet-signer">Responsable (signature)</Label>
              <Input id="sheet-signer" value={signer} onChange={(e) => { setSigner(e.target.value); setSignerTouched(true) }} disabled={closed} className="mt-1" placeholder="Prénom du responsable" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {closed ? (
              <Badge className="bg-emerald-600 text-white"><Lock className="mr-1 h-3 w-3" />Clôturée le {formatStamp(data?.closure?.closed_at)} par {data?.closure?.closed_by === "auto" ? "la clôture automatique" : data?.closure?.closed_by || "—"}</Badge>
            ) : (
              <Badge variant="outline">Aperçu : journée non clôturée</Badge>
            )}
            {data?.closure?.sent_at && <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" />Envoyée le {formatStamp(data.closure.sent_at)} à {data.closure.sent_to.join(", ")}</Badge>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" disabled={!salonId}>
              <a href={pdfUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Télécharger le PDF</a>
            </Button>
            {!closed && (
              <>
                <Button onClick={() => close(false)} disabled={busy !== null || !data}><Lock className="mr-2 h-4 w-4" />{busy === "close" ? "Clôture…" : "Clôturer"}</Button>
                <Button onClick={() => close(true)} disabled={busy !== null || !data || !settings.data?.emailEnabled} title={!settings.data?.emailEnabled ? "Envoi d'e-mails désactivé sur ce déploiement" : undefined}>
                  <Mail className="mr-2 h-4 w-4" />{busy === "close-send" ? "Clôture et envoi…" : "Clôturer et envoyer"}
                </Button>
              </>
            )}
            {closed && (
              <Button variant="outline" onClick={resend} disabled={busy !== null || !settings.data?.emailEnabled}><Mail className="mr-2 h-4 w-4" />{busy === "send" ? "Envoi…" : data?.closure?.sent_at ? "Renvoyer par e-mail" : "Envoyer par e-mail"}</Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Clôturer fige les lignes et les totaux de la journée ; le PDF est ensuite toujours produit depuis cette copie. Une journée déjà clôturée ne peut pas l'être une seconde fois.
          </p>
        </Card>

        {sheet.isLoading && <p className="text-sm text-muted-foreground">Chargement de la feuille…</p>}
        {sheet.error && <p className="text-sm text-destructive">{errorText(sheet.error)}</p>}
        {data && (
          <div className="grid gap-4 md:gap-6 xl:grid-cols-[1fr_320px]">
            <Card className="p-2 sm:p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 pb-2">
                <h2 className="text-lg font-semibold">{data.sheet.salon.name} · {data.sheet.date.split("-").reverse().join("/")}</h2>
                <span className="text-sm text-muted-foreground">Référence {data.sheet.reference}</span>
              </div>
              <SheetTable sheet={data.sheet} />
            </Card>
            <Card className="p-4">
              <h2 className="mb-3 text-lg font-semibold">Récapitulatif</h2>
              <Recap sheet={data.sheet} />
              <p className="mt-3 text-xs text-muted-foreground">Les origines comptent les RDV hors absences. L'origine Planity ou Treatwell ne prouve pas un paiement. Les montants sont ceux enregistrés pour les RDV de cette journée, même si le paiement a eu lieu avant.</p>
            </Card>
          </div>
        )}

        {settings.data && <SettingsCard data={settings.data} isAdmin={isAdmin} />}
        {settings.error && <p className="text-sm text-destructive">{errorText(settings.error)}</p>}
      </div>
    </div>
  )
}
