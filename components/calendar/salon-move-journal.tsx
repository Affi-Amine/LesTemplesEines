"use client"

import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fetchAPI } from "@/lib/api/client"
import type { SalonMoveLog, SalonMoveSnapshot } from "@/lib/appointments/salon-moves"

const overrideLabels: Record<string, string> = {
  overlap: "Chevauchement autorisé", overlapping: "Chevauchement autorisé",
  past: "Horaire passé", past_time: "Horaire passé", outside_hours: "Hors horaires", hours: "Hors horaires", opening_hours: "Hors horaires",
  qualification: "Prestation hors habilitation", availability: "Indisponibilité outrepassée",
}

function Snapshot({ value, label }: { value: SalonMoveSnapshot; label: string }) {
  const sameDay = formatInTimeZone(value.start_time, "Europe/Paris", "yyyy-MM-dd") === formatInTimeZone(value.end_time, "Europe/Paris", "yyyy-MM-dd")
  return <div className="min-w-0 rounded-lg border bg-muted/20 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-semibold">{formatInTimeZone(value.start_time, "Europe/Paris", "dd/MM/yyyy · HH:mm")} – {formatInTimeZone(value.end_time, "Europe/Paris", sameDay ? "HH:mm" : "dd/MM/yyyy · HH:mm")}</p>
    <p className="mt-1 break-words text-sm">{value.staff?.map(member => member.name).join(" + ") || "Équipe non précisée"}</p>
  </div>
}

export function SalonMoveJournal({ salonId }: { salonId: string }) {
  const [open, setOpen] = useState(false)
  const journal = useInfiniteQuery({
    queryKey: ["salon-move-log", salonId], enabled: open, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchAPI<{ entries: SalonMoveLog[]; next_cursor: string | null }>(
      `/admin/salons/${salonId}/appointment-moves?limit=20${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: last => last.next_cursor || undefined,
    staleTime: 0,
  })
  const entries = journal.data?.pages.flatMap(page => page.entries) || []
  return <>
    <Button data-salon-move-journal type="button" variant="outline" onClick={() => setOpen(true)} aria-label="Journal des déplacements" className="h-11 shrink-0 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm"><History className="h-4 w-4" />Journal</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Journal des déplacements</DialogTitle>
          <DialogDescription>Qui a déplacé un rendez-vous, quand et vers quel créneau. Heures de Paris.</DialogDescription>
        </DialogHeader>
        {journal.isPending && <p role="status" className="py-6 text-sm text-muted-foreground">Chargement du journal…</p>}
        {journal.isError && <div role="alert" className="space-y-3 rounded-lg border p-3 text-sm"><p>{journal.error.message}</p><Button variant="outline" onClick={() => void journal.refetch()}>Réessayer</Button></div>}
        {!journal.isPending && !journal.isError && !entries.length && <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Aucun déplacement enregistré pour ce salon.</p>}
        <ol className="space-y-3">
          {entries.map(entry => <li key={entry.id} data-move-journal-entry className="space-y-3 rounded-xl border p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
              <p className="font-semibold">{entry.changes.actor?.name || "Membre de l’équipe"}</p>
              <time dateTime={entry.created_at} className="text-muted-foreground">{formatInTimeZone(entry.created_at, "Europe/Paris", "d MMM yyyy · HH:mm", { locale: fr })}</time>
            </div>
            <div><p className="break-words text-sm font-semibold">{entry.changes.client?.name || "Créneau bloqué"}</p><p className="break-words text-xs text-muted-foreground">{entry.changes.service?.name || "Indisponibilité"}</p></div>
            <div className="grid gap-2 sm:grid-cols-2"><Snapshot value={entry.changes.before} label="Avant" /><Snapshot value={entry.changes.after} label="Après" /></div>
            {Boolean(entry.changes.overrides?.length) && <p className="text-xs text-muted-foreground">{entry.changes.overrides?.map(code => overrideLabels[code] || code).join(" · ")}</p>}
          </li>)}
        </ol>
        {journal.hasNextPage && <Button variant="outline" onClick={() => void journal.fetchNextPage()} disabled={journal.isFetchingNextPage}>{journal.isFetchingNextPage ? "Chargement…" : "Voir les déplacements précédents"}</Button>}
      </DialogContent>
    </Dialog>
  </>
}
