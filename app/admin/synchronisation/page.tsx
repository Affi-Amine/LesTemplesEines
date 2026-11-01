"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock3, KeyRound, LogOut, Play, RefreshCw, Trash2, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"

import { AdminHeader } from "@/components/admin-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { fetchAPI } from "@/lib/api/client"
import { useRoleProtection } from "@/lib/hooks/use-role-protection"
import type { ConnectionTest, MappingOverview, RunSummary, SyncStatus } from "@/lib/sync/admin"
import type { PlatformReport, SyncReport } from "@/lib/sync/engine"
import type { Platform } from "@/lib/sync/types"

const PLATFORMS: Platform[] = ["planity", "treatwell"]
const LABELS: Record<Platform, string> = { planity: "Planity", treatwell: "Treatwell" }
const ACTION_LABELS: Record<keyof PlatformReport["counts"], string> = {
  import: "importés sur le site",
  match: "reliés (déjà présents des deux côtés)",
  push: "envoyés sur la plateforme",
  update_local: "modifiés sur le site",
  update_remote: "modifiés sur la plateforme",
  cancel_local: "annulés sur le site",
  cancel_remote: "annulés sur la plateforme",
}
const STATUS_QUERY = ["admin", "platform-sync", "status"]

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(value))
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—"
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inattendue"
}

function StatusBadge({ status }: { status: PlatformReport["status"] | RunSummary["status"] }) {
  if (status === "ok" || status === "done") return <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3" />OK</Badge>
  if (status === "running") return <Badge variant="secondary"><Clock3 className="mr-1 h-3 w-3" />En cours</Badge>
  if (status === "unavailable") return <Badge variant="outline" className="border-amber-500 text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" />Indisponible</Badge>
  return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Erreur</Badge>
}

/** One platform's section of a run report: mapping, counters, warnings, actions. */
function ReportView({ report }: { report: SyncReport }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {report.mode === "live" ? "Exécution réelle" : "Simulation"} · fenêtre du {report.window.from} au {report.window.to} · {formatDuration(report.durationMs)}
      </p>
      {PLATFORMS.map((platform) => {
        const section = report.platforms[platform]
        if (!section) return null
        const totals = Object.entries(section.counts).filter(([, count]) => count > 0)
        return (
          <div key={platform} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{LABELS[platform]}</span>
              <StatusBadge status={section.status} />
              <span className="text-sm text-muted-foreground">{section.fetched} réservation{section.fetched > 1 ? "s" : ""} lue{section.fetched > 1 ? "s" : ""}</span>
            </div>
            {section.message && <p className="mt-2 text-sm text-destructive">{section.message}</p>}
            {section.mapping && (
              <div className="mt-2 text-sm">
                <p>
                  {section.mapping.salons.length} salon{section.mapping.salons.length > 1 ? "s" : ""} apparié{section.mapping.salons.length > 1 ? "s" : ""}
                  {section.mapping.salons.length > 0 && ` (${section.mapping.salons.map((s) => `${s.salon} ↔ ${s.venue}`).join(", ")})`}
                  , {section.mapping.staff.length} masseuse{section.mapping.staff.length > 1 ? "s" : ""}, {section.mapping.services} prestation{section.mapping.services > 1 ? "s" : ""}.
                </p>
                {section.mapping.unmappedVenues.length > 0 && <p className="text-amber-700">Établissements sans salon : {section.mapping.unmappedVenues.join(", ")}</p>}
                {section.mapping.unmappedColumns.length > 0 && <p className="text-amber-700">Colonnes sans masseuse : {section.mapping.unmappedColumns.join(", ")}</p>}
              </div>
            )}
            {totals.length > 0 ? (
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {totals.map(([kind, count]) => <li key={kind}><span className="font-medium">{count}</span> {ACTION_LABELS[kind as keyof typeof ACTION_LABELS]}</li>)}
              </ul>
            ) : section.status === "ok" && <p className="mt-2 text-sm text-muted-foreground">Rien à faire : les agendas sont alignés.</p>}
            {section.warnings.length > 0 && (
              <details className="mt-2 text-sm" open={section.warnings.length <= 5}>
                <summary className="cursor-pointer font-medium text-amber-700">{section.warnings.length} avertissement{section.warnings.length > 1 ? "s" : ""}</summary>
                <ul className="mt-1 list-disc space-y-1 pl-5">{section.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </details>
            )}
            {section.actions.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-medium">{section.actions.length} action{section.actions.length > 1 ? "s" : ""}{report.mode === "dry-run" ? " prévue" : ""}{section.actions.length > 1 && report.mode === "dry-run" ? "s" : ""}</summary>
                <ul className="mt-1 space-y-1 pl-1">
                  {section.actions.map((a, i) => <li key={i}><Badge variant="outline" className="mr-2">{a.kind}</Badge>{a.detail}</li>)}
                </ul>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ConnectionResult({ result }: { result: ConnectionTest }) {
  return (
    <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Connexion {LABELS[result.platform]} réussie : {result.venues.length} établissement{result.venues.length > 1 ? "s" : ""}</p>
      <ul className="mt-1 space-y-1">
        {result.venues.map((venue) => (
          <li key={venue.id}>
            <span className="font-medium">{venue.name}</span> · {venue.staff.length} colonne{venue.staff.length > 1 ? "s" : ""} ({venue.staff.map((s) => s.name).join(", ") || "aucune"}) · {venue.services} prestation{venue.services > 1 ? "s" : ""}
          </li>
        ))}
      </ul>
      <p className="mt-2">
        Associations : {result.mapping.salons.length} salon{result.mapping.salons.length > 1 ? "s" : ""}, {result.mapping.staff.length} masseuse{result.mapping.staff.length > 1 ? "s" : ""}, {result.mapping.services} prestation{result.mapping.services > 1 ? "s" : ""}.
      </p>
      {result.mapping.unmappedVenues.length > 0 && <p className="text-amber-700">Établissements sans salon : {result.mapping.unmappedVenues.join(", ")}</p>}
      {result.mapping.unmappedColumns.length > 0 && <p className="text-amber-700">Colonnes sans masseuse : {result.mapping.unmappedColumns.join(", ")}</p>}
    </div>
  )
}

function PlatformCard({ platform, status, disabled }: { platform: Platform; status: SyncStatus["platforms"][Platform]; disabled: boolean }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [sessionInput, setSessionInput] = useState("")
  const [test, setTest] = useState<ConnectionTest | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: STATUS_QUERY })

  const act = async (name: string, work: () => Promise<void>) => {
    setBusy(name)
    try {
      await work()
      await refresh()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  const saveCredentials = () => act("credentials", async () => {
    await fetchAPI("/admin/platform-sync/credentials", { method: "PUT", body: JSON.stringify({ platform, username, password }) })
    setUsername("")
    setPassword("")
    toast.success(`Identifiants ${LABELS[platform]} enregistrés et connexion réussie`)
  })
  const forgetCredentials = () => act("forget-credentials", async () => {
    if (!window.confirm(`Supprimer les identifiants ${LABELS[platform]} enregistrés ? La synchronisation utilisera les variables d'environnement, s'il y en a.`)) return
    await fetchAPI("/admin/platform-sync/credentials", { method: "DELETE", body: JSON.stringify({ platform }) })
    toast.success("Identifiants supprimés")
  })
  const relogin = () => act("relogin", async () => {
    await fetchAPI("/admin/platform-sync/session", { method: "POST", body: JSON.stringify({ platform }) })
    toast.success(`Nouvelle session ${LABELS[platform]} enregistrée`)
  })
  const importSession = () => act("import", async () => {
    const result = await fetchAPI<{ venues: string[] }>("/admin/platform-sync/session", { method: "POST", body: JSON.stringify({ platform, input: sessionInput }) })
    setSessionInput("")
    toast.success(`Session Treatwell enregistrée · ${result.venues.join(", ") || "aucun établissement"}`)
  })
  const forgetSession = () => act("forget-session", async () => {
    if (!window.confirm(`Oublier la session ${LABELS[platform]} ? La prochaine exécution devra se reconnecter${platform === "treatwell" ? " : une nouvelle session devra être importée" : ""}.`)) return
    await fetchAPI("/admin/platform-sync/session", { method: "DELETE", body: JSON.stringify({ platform }) })
    toast.success("Session oubliée")
  })
  const testConnection = () => act("test", async () => {
    setTest(await fetchAPI<ConnectionTest>("/admin/platform-sync/test", { method: "POST", body: JSON.stringify({ platform }) }))
  })

  const session = status.session
  const sessionOk = session.readable && !(platform === "treatwell" && session.expired)

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{LABELS[platform]}</h2>
        {status.lastRun ? <StatusBadge status={status.lastRun.status} /> : <Badge variant="outline">Jamais synchronisé</Badge>}
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <dt className="text-muted-foreground">Identifiants</dt>
        <dd>
          {status.credentials.source === "database" && <>Enregistrés ici ({status.credentials.username}) le {formatDate(status.credentials.updatedAt)}</>}
          {status.credentials.source === "environment" && <>Variables d'environnement ({status.credentials.username})</>}
          {status.credentials.source === "none" && (platform === "planity" ? <span className="text-destructive">Aucun : à saisir ci-dessous</span> : <span className="text-muted-foreground">Non requis (connexion par session)</span>)}
        </dd>
        <dt className="text-muted-foreground">Session</dt>
        <dd>
          {!session.updatedAt && <span className={platform === "treatwell" ? "text-destructive" : "text-muted-foreground"}>Aucune{platform === "planity" ? " (créée à la prochaine exécution)" : ""}</span>}
          {session.updatedAt && !session.readable && <span className="text-destructive">Illisible (clé de chiffrement changée ?) : à renouveler</span>}
          {session.updatedAt && session.readable && (
            <>
              {sessionOk ? "Valide" : <span className="text-destructive">Expirée</span>}, enregistrée le {formatDate(session.updatedAt)}
              {platform === "treatwell" && <> · {session.cookies} cookies{session.expiresAt && <>, expire le {formatDate(session.expiresAt)}</>}{session.venueId && <>, établissement {session.venueId}</>}</>}
            </>
          )}
        </dd>
        <dt className="text-muted-foreground">Dernier passage</dt>
        <dd>
          {status.lastRun ? (
            <>
              {formatDate(status.lastRun.at)}
              {status.lastRun.message && <span className="block text-destructive">{status.lastRun.message}</span>}
              {status.lastRun.warnings > 0 && <span className="block text-amber-700">{status.lastRun.warnings} avertissement{status.lastRun.warnings > 1 ? "s" : ""}</span>}
            </>
          ) : "—"}
        </dd>
      </dl>

      {platform === "planity" && (
        <form
          className="mt-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
          onSubmit={(event) => { event.preventDefault(); saveCredentials() }}
        >
          <div>
            <Label htmlFor="planity-username">Identifiant Planity Pro</Label>
            <Input id="planity-username" type="email" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1" placeholder="email@salon.fr" />
          </div>
          <div>
            <Label htmlFor="planity-password">Mot de passe</Label>
            <Input id="planity-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={disabled || !username || !password || busy !== null}>
              <KeyRound className="mr-2 h-4 w-4" />{busy === "credentials" ? "Connexion…" : "Enregistrer et se connecter"}
            </Button>
            {status.credentials.source === "database" && (
              <Button type="button" variant="outline" disabled={disabled || busy !== null} onClick={forgetCredentials}>
                <Trash2 className="mr-2 h-4 w-4" />Supprimer les identifiants
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Le mot de passe est chiffré en base et testé immédiatement auprès de Planity. Il n'est jamais renvoyé au navigateur.</p>
        </form>
      )}

      {platform === "treatwell" && (
        <form className="mt-4 space-y-3 rounded-lg border p-3" onSubmit={(event) => { event.preventDefault(); importSession() }}>
          <div>
            <Label htmlFor="treatwell-session">Session Treatwell</Label>
            <Textarea
              id="treatwell-session"
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              rows={3}
              className="mt-1 font-mono text-xs"
              placeholder="Collez le contenu de .sync/treatwell-session.enc, ou l'en-tête Cookie d'une requête vers connect.treatwell.fr (ATKT=… ; ITKT=… ; extranet.currentVenueId=…)"
            />
          </div>
          <Button type="submit" disabled={disabled || !sessionInput.trim() || busy !== null}>
            <Upload className="mr-2 h-4 w-4" />{busy === "import" ? "Vérification…" : "Importer la session"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Treatwell Connect impose une vérification humaine à la connexion : la session vient toujours d'un navigateur. Connectez-vous avec « Rester connecté » (session d'environ trois mois), puis collez ici la session produite par <code>npm run sync:login -- treatwell</code> ou l'en-tête Cookie copié depuis les outils de développement. Elle est vérifiée avant d'être conservée.
          </p>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {platform === "planity" && (
          <Button variant="outline" disabled={disabled || busy !== null || status.credentials.source === "none"} onClick={relogin}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy === "relogin" ? "animate-spin" : ""}`} />Se reconnecter
          </Button>
        )}
        <Button variant="outline" disabled={disabled || busy !== null} onClick={testConnection}>
          <CheckCircle2 className="mr-2 h-4 w-4" />{busy === "test" ? "Test…" : "Tester la connexion"}
        </Button>
        {session.updatedAt && (
          <Button variant="ghost" disabled={disabled || busy !== null} onClick={forgetSession}>
            <LogOut className="mr-2 h-4 w-4" />Oublier la session
          </Button>
        )}
      </div>
      {test && <ConnectionResult result={test} />}
    </Card>
  )
}

function RunCard({ status }: { status: SyncStatus }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [platform, setPlatform] = useState<"" | Platform>("")
  const [report, setReport] = useState<SyncReport | null>(null)

  const run = async (mode: "dry-run" | "live") => {
    if (mode === "live" && !window.confirm("Lancer une exécution réelle maintenant ? Les agendas seront modifiés.")) return
    setBusy(true)
    try {
      setReport(await fetchAPI<SyncReport>("/admin/platform-sync/run", { method: "POST", body: JSON.stringify({ mode, platform: platform || undefined }) }))
      toast.success(mode === "live" ? "Synchronisation effectuée" : "Simulation terminée")
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY })
    }
  }

  const blocked = !status.migrations.base
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-xl font-semibold">Lancer un passage</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        La simulation lit les deux agendas et indique ce qui serait fait, sans rien écrire. L'exécution réelle n'est possible que si le déploiement est en mode réel.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="run-platform">Plateforme</Label>
          <select id="run-platform" value={platform} onChange={(e) => setPlatform(e.target.value as "" | Platform)} className="mt-1 block h-10 rounded-lg border bg-card px-3 text-sm">
            <option value="">Les deux</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{LABELS[p]}</option>)}
          </select>
        </div>
        <Button disabled={busy || blocked} onClick={() => run("dry-run")}>
          <Play className="mr-2 h-4 w-4" />{busy ? "En cours…" : "Simuler"}
        </Button>
        <Button variant="destructive" disabled={busy || blocked || status.mode !== "live"} onClick={() => run("live")} title={status.mode !== "live" ? "Passer PLATFORM_SYNC_MODE=live pour autoriser les écritures" : undefined}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />Exécuter réellement
        </Button>
      </div>
      {report && <div className="mt-4"><ReportView report={report} /></div>}
    </Card>
  )
}

function RunHistory({ runs }: { runs: RunSummary[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const detail = useQuery({
    queryKey: ["admin", "platform-sync", "run", openId],
    queryFn: () => fetchAPI<{ id: string; mode: string; status: string; error: string | null; report: SyncReport | null }>(`/admin/platform-sync/runs/${openId}`),
    enabled: Boolean(openId),
  })

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-xl font-semibold">Historique</h2>
      {runs.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucun passage pour l'instant.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Début</th>
                <th className="py-2 pr-3 font-medium">Mode</th>
                <th className="py-2 pr-3 font-medium">Statut</th>
                <th className="py-2 pr-3 font-medium">Durée</th>
                <th className="py-2 pr-3 font-medium">Déclencheur</th>
                <th className="py-2 pr-3 font-medium">Planity</th>
                <th className="py-2 pr-3 font-medium">Treatwell</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(run.startedAt)}</td>
                  <td className="py-2 pr-3">{run.mode === "live" ? <Badge variant="destructive">réel</Badge> : <Badge variant="secondary">simulation</Badge>}</td>
                  <td className="py-2 pr-3"><StatusBadge status={run.status} />{run.error && <span className="mt-1 block max-w-xs text-xs text-destructive">{run.error}</span>}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDuration(run.durationMs)}</td>
                  <td className="py-2 pr-3">{run.triggeredBy || "cron"}</td>
                  {PLATFORMS.map((platform) => {
                    const section = run.platforms[platform]
                    const total = section ? Object.values(section.counts).reduce((sum, n) => sum + n, 0) : 0
                    return (
                      <td key={platform} className="py-2 pr-3 whitespace-nowrap">
                        {section ? <>
                          <StatusBadge status={section.status} /> <span>{total} action{total > 1 ? "s" : ""}</span>
                          {section.warnings > 0 && <span className="text-amber-700"> · {section.warnings} avert.</span>}
                        </> : "—"}
                      </td>
                    )
                  })}
                  <td className="py-2"><Button size="sm" variant="ghost" onClick={() => setOpenId(run.id)}>Rapport</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(openId)} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Rapport du passage</DialogTitle>
            <DialogDescription>Actions réalisées ou prévues, avertissements et associations utilisées.</DialogDescription>
          </DialogHeader>
          {detail.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {detail.error && <p className="text-sm text-destructive">{errorText(detail.error)}</p>}
          {detail.data?.error && <p className="text-sm text-destructive">{detail.data.error}</p>}
          {detail.data?.report ? <ReportView report={detail.data.report} /> : detail.data && !detail.data.error && <p className="text-sm text-muted-foreground">Pas de rapport (passage interrompu).</p>}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function MappingsCard({ disabled }: { disabled: boolean }) {
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<Platform>("planity")
  const [kind, setKind] = useState<"salon" | "staff" | "service">("staff")
  const [localId, setLocalId] = useState("")
  const [venueId, setVenueId] = useState("")
  const [externalId, setExternalId] = useState("")
  const [busy, setBusy] = useState(false)
  const key = ["admin", "platform-sync", "mappings", platform]
  const overview = useQuery({ queryKey: key, queryFn: () => fetchAPI<MappingOverview>(`/admin/platform-sync/mappings?platform=${platform}`), enabled: !disabled })
  const data = overview.data

  const venues = data?.venues || []
  const venue = venues.find((v) => v.id === venueId) || venues[0]
  const localOptions = kind === "salon" ? data?.salons.map((s) => ({ id: s.id, label: s.name })) || []
    : kind === "staff" ? data?.staff.map((s) => ({ id: s.id, label: `${s.label} (${data.salons.find((salon) => salon.id === s.salon_id)?.name || "?"})` })) || []
    : data?.services.map((s) => ({ id: s.id, label: `${s.name} · ${s.duration_minutes} min` })) || []
  const externalOptions = kind === "salon" ? venues.map((v) => ({ id: v.id, label: v.name }))
    : kind === "staff" ? venue?.staff.map((s) => ({ id: s.id, label: s.name })) || []
    : venue?.services.map((s) => ({ id: s.id, label: `${s.name} · ${s.durationMinutes} min` })) || []
  const localName = (k: string, id: string) =>
    k === "salon" ? data?.salons.find((s) => s.id === id)?.name : k === "staff" ? data?.staff.find((s) => s.id === id)?.label : data?.services.find((s) => s.id === id)?.name
  const externalName = (k: string, id: string | null, venueKey: string) => {
    if (id === null) return "ne pas synchroniser"
    if (k === "salon") return venues.find((v) => v.id === id)?.name || id
    const owner = venues.find((v) => v.id === venueKey)
    const item = k === "staff" ? owner?.staff.find((s) => s.id === id) : owner?.services.find((s) => s.id === id)
    return `${item?.name || id}${owner ? ` (${owner.name})` : ""}`
  }

  const save = async () => {
    setBusy(true)
    try {
      await fetchAPI("/admin/platform-sync/mappings", {
        method: "POST",
        body: JSON.stringify({
          platform, kind, local_id: localId,
          external_id: externalId === "__none__" ? null : externalId,
          external_venue_id: kind === "salon" ? "" : venue?.id || "",
        }),
      })
      toast.success("Association enregistrée ; elle s'applique au prochain passage")
      setLocalId("")
      setExternalId("")
      queryClient.invalidateQueries({ queryKey: key })
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }
  const remove = async (id: string) => {
    if (!window.confirm("Retirer cette association ? L'appariement automatique par nom reprendra.")) return
    try {
      await fetchAPI("/admin/platform-sync/mappings", { method: "DELETE", body: JSON.stringify({ id }) })
      queryClient.invalidateQueries({ queryKey: key })
    } catch (error) {
      toast.error(errorText(error))
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Associations</h2>
        <div className="flex gap-1 rounded-lg border p-1">
          {PLATFORMS.map((p) => (
            <Button key={p} size="sm" variant={platform === p ? "default" : "ghost"} onClick={() => { setPlatform(p); setVenueId(""); setLocalId(""); setExternalId("") }}>{LABELS[p]}</Button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Salons, masseuses et prestations sont appariés par leur nom. Ajoutez une association quand les noms diffèrent, ou pour exclure un élément de la synchronisation.
      </p>

      {overview.isLoading && <p className="mt-3 text-sm text-muted-foreground">Lecture de {LABELS[platform]}…</p>}
      {overview.error && <p className="mt-3 text-sm text-destructive">{errorText(overview.error)}</p>}
      {data?.venuesError && <p className="mt-3 text-sm text-destructive">{LABELS[platform]} injoignable : {data.venuesError}</p>}

      {data?.summary && (
        <div className="mt-3 space-y-1 text-sm">
          <p className="font-medium">Appariement automatique</p>
          {data.summary.salons.map((s) => <p key={s.salon}>{s.salon} ↔ {s.venue}</p>)}
          {data.summary.staff.map((s) => <p key={`${s.salon}-${s.staff}`} className="text-muted-foreground">{s.salon} · {s.staff} ↔ {s.column}</p>)}
          <p className="text-muted-foreground">{data.summary.services} prestation{data.summary.services > 1 ? "s" : ""} appariée{data.summary.services > 1 ? "s" : ""}</p>
          {data.summary.unmappedVenues.length > 0 && <p className="text-amber-700">Établissements sans salon : {data.summary.unmappedVenues.join(", ")}</p>}
          {data.summary.unmappedColumns.length > 0 && <p className="text-amber-700">Colonnes sans masseuse : {data.summary.unmappedColumns.join(", ")}</p>}
        </div>
      )}

      {data && (
        <div className="mt-4">
          <p className="text-sm font-medium">Associations manuelles</p>
          {data.overrides.length === 0 ? <p className="text-sm text-muted-foreground">Aucune.</p> : (
            <ul className="mt-1 divide-y rounded-lg border text-sm">
              {data.overrides.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span><Badge variant="outline" className="mr-2">{o.kind === "salon" ? "salon" : o.kind === "staff" ? "masseuse" : "prestation"}</Badge>{localName(o.kind, o.local_id) || o.local_id} → {externalName(o.kind, o.external_id, o.external_venue_id)}</span>
                  <Button size="sm" variant="ghost" onClick={() => remove(o.id)} aria-label="Retirer"><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {data && venues.length > 0 && (
        <form className="mt-4 grid gap-3 rounded-lg border p-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save() }}>
          <div>
            <Label htmlFor="map-kind">Type</Label>
            <select id="map-kind" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setLocalId(""); setExternalId("") }} className="mt-1 block h-10 w-full rounded-lg border bg-card px-3 text-sm">
              <option value="salon">Salon ↔ établissement</option>
              <option value="staff">Masseuse ↔ colonne d'agenda</option>
              <option value="service">Prestation ↔ prestation</option>
            </select>
          </div>
          {kind !== "salon" && (
            <div>
              <Label htmlFor="map-venue">Établissement {LABELS[platform]}</Label>
              <select id="map-venue" value={venue?.id || ""} onChange={(e) => { setVenueId(e.target.value); setExternalId("") }} className="mt-1 block h-10 w-full rounded-lg border bg-card px-3 text-sm">
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="map-local">Sur le site</Label>
            <select id="map-local" value={localId} onChange={(e) => setLocalId(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border bg-card px-3 text-sm">
              <option value="">Choisir…</option>
              {localOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="map-external">Sur {LABELS[platform]}</Label>
            <select id="map-external" value={externalId} onChange={(e) => setExternalId(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border bg-card px-3 text-sm">
              <option value="">Choisir…</option>
              <option value="__none__">Ne pas synchroniser</option>
              {externalOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy || !localId || !externalId}>Enregistrer l'association</Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export default function SynchronisationPage() {
  const isAuthorized = useRoleProtection(["admin"])
  const status = useQuery({ queryKey: STATUS_QUERY, queryFn: () => fetchAPI<SyncStatus>("/admin/platform-sync"), enabled: Boolean(isAuthorized), refetchInterval: 60_000 })

  if (!isAuthorized) return null
  const data = status.data
  const blocked = Boolean(data && !data.migrations.base)

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Synchronisation" description="Planity et Treatwell : connexions, exécutions et associations" />

      <div className="max-w-5xl space-y-4 p-3 sm:p-6 md:space-y-6">
        {status.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {status.error && <p className="text-sm text-destructive">{errorText(status.error)}</p>}

        {data && (
          <>
            <Card className="p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold">État</h2>
                {data.mode === "live" ? <Badge variant="destructive">Mode réel : les agendas sont modifiés</Badge> : <Badge variant="secondary">Mode simulation : rien n'est écrit</Badge>}
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Fenêtre synchronisée</dt><dd>Aujourd'hui + {data.windowDays} jours</dd></div>
                <div><dt className="text-muted-foreground">Tâche planifiée</dt><dd>{data.cronConfigured ? "Jeton configuré (CRON_SECRET)" : <span className="text-destructive">CRON_SECRET absent : la tâche planifiée ne peut pas s'exécuter</span>}</dd></div>
                <div><dt className="text-muted-foreground">Chiffrement des sessions</dt><dd>{data.secretSource === "dedicated" ? "Clé dédiée (PLATFORM_SYNC_SECRET)" : data.secretSource === "jwt" ? "Clé JWT_SECRET (repli)" : <span className="text-destructive">Aucune clé</span>}</dd></div>
                <div><dt className="text-muted-foreground">Base de données</dt><dd>
                  {!data.migrations.base && <span className="text-destructive">Migration 2026-10-30_platform_sync.sql à exécuter</span>}
                  {data.migrations.base && !data.migrations.admin && <span className="text-amber-700">Migration 2026-11-01_platform_sync_admin.sql à exécuter (identifiants et déclencheur)</span>}
                  {data.migrations.base && data.migrations.admin && "Migrations appliquées"}
                </dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">Le mode se change par la variable PLATFORM_SYNC_MODE du déploiement. Documentation : docs/platform-sync.md.</p>
            </Card>

            <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
              {PLATFORMS.map((platform) => <PlatformCard key={platform} platform={platform} status={data.platforms[platform]} disabled={blocked} />)}
            </div>

            <RunCard status={data} />
            <RunHistory runs={data.runs} />
            <MappingsCard disabled={blocked} />
          </>
        )}
      </div>
    </div>
  )
}
