"use client"

import { formatInTimeZone } from "date-fns-tz"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { getStaffDisplayName } from "@/lib/calendar/scheduling"
import type { AppointmentMove, MoveStaff } from "@/lib/calendar/appointment-move"

export function AppointmentMoveDialog({ move, staff, saving, error, onCancel, onConfirm }: {
  move: AppointmentMove | null; staff: MoveStaff[]; saving: boolean; error: string; onCancel: () => void; onConfirm: () => void
}) {
  const time = (date: Date | string) => formatInTimeZone(date, "Europe/Paris", "dd/MM/yyyy à HH:mm")
  return <Dialog open={Boolean(move)} onOpenChange={open => { if (!open && !saving) onCancel() }}>
    <DialogContent className="sm:max-w-[480px]" showCloseButton={!saving}>
      <DialogHeader><DialogTitle>Confirmer le déplacement</DialogTitle><DialogDescription>Vérifiez le nouvel horaire et l’équipe avant d’enregistrer.</DialogDescription></DialogHeader>
      {move && <div className="space-y-4 text-sm">
        <p className="font-semibold">{[move.appointment.client?.first_name, move.appointment.client?.last_name].filter(Boolean).join(" ") || "Rendez-vous"}</p>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Ancien créneau</p><p>{time(move.appointment.start_time)} – {formatInTimeZone(move.appointment.end_time, "Europe/Paris", "HH:mm")}</p></div>
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Nouveau créneau · heure de Paris</p><p className="font-semibold">{time(move.start)} – {formatInTimeZone(move.end, "Europe/Paris", "HH:mm")}</p><p className="mt-2">{move.staffIds.map(id => { const member = staff.find(item => item.id === id); return member ? getStaffDisplayName(member) : "Masseuse affectée" }).join(" + ")}</p></div>
        {move.staffIds.length > 1 && <p>Toute l’équipe du duo est conservée et sera déplacée ensemble.</p>}
      </div>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button><Button onClick={onConfirm} disabled={saving}>{saving ? "Enregistrement…" : "Confirmer le déplacement"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
