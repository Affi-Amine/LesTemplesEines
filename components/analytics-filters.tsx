"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Filter, X, Clock } from "lucide-react"
import { format, startOfWeek, startOfMonth, startOfYear, subDays, subWeeks, subMonths } from "date-fns"

export interface AnalyticsFilters {
  startDate: string
  endDate: string
  startHour: string
  endHour: string
  salonId: string
  staffId: string
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFilters
  onFiltersChange: (filters: AnalyticsFilters) => void
  salons: Array<{ id: string; name: string; city: string }>
  staff: Array<{ id: string; first_name: string; last_name: string; salon_id: string }>
}

const timeSlots = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
]

const datePresets = [
  { label: "Aujourd'hui", getValue: () => ({ start: new Date(), end: new Date() }) },
  { label: "Hier", getValue: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
  { label: "7 derniers jours", getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: "30 derniers jours", getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: "Cette semaine", getValue: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: new Date() }) },
  { label: "Ce mois", getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
  { label: "Mois dernier", getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: startOfMonth(new Date()) }) },
  { label: "Cette année", getValue: () => ({ start: startOfYear(new Date()), end: new Date() }) },
]

export function AnalyticsFilters({ filters, onFiltersChange, salons, staff }: AnalyticsFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localFilters, setLocalFilters] = useState(filters)

  // Filter staff based on selected salon
  const filteredStaff = filters.salonId 
    ? staff.filter(s => s.salon_id === filters.salonId)
    : staff

  const updateFilter = (key: keyof AnalyticsFilters, value: string) => {
    const newFilters = { ...localFilters, [key]: value }
    
    // If salon changes, reset staff filter
    if (key === 'salonId') {
      newFilters.staffId = ''
    }
    
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const applyDatePreset = (preset: typeof datePresets[0]) => {
    const { start, end } = preset.getValue()
    const newFilters = {
      ...localFilters,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd')
    }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const clearFilters = () => {
    const clearedFilters: AnalyticsFilters = {
      startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      startHour: '',
      endHour: '',
      salonId: '',
      staffId: ''
    }
    setLocalFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const hasActiveFilters = filters.salonId || filters.staffId || filters.startHour || filters.endHour

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="font-semibold">Filtres</h3>
          {hasActiveFilters && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
              Actif
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Effacer
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Réduire' : 'Développer'}
          </Button>
        </div>
      </div>

      {/* Always visible: Date range */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <Label htmlFor="startDate" className="text-sm font-medium">Date de début</Label>
          <Input
            id="startDate"
            type="date"
            value={localFilters.startDate}
            onChange={(e) => updateFilter('startDate', e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="endDate" className="text-sm font-medium">Date de fin</Label>
          <Input
            id="endDate"
            type="date"
            value={localFilters.endDate}
            onChange={(e) => updateFilter('endDate', e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex items-end">
          <div className="w-full">
            <Label className="text-sm font-medium">Sélection rapide</Label>
            <Select onValueChange={(value) => {
              const preset = datePresets.find(p => p.label === value)
              if (preset) applyDatePreset(preset)
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choisir un préréglage" />
              </SelectTrigger>
              <SelectContent>
                {datePresets.map((preset) => (
                  <SelectItem key={preset.label} value={preset.label}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Expandable filters */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t">
          {/* Time Range Filters */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4" />
              <Label className="text-sm font-medium">Plage horaire</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startHour" className="text-sm">Heure de début</Label>
                <Select value={localFilters.startHour || "any"} onValueChange={(value) => updateFilter('startHour', value === "any" ? "" : value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="N'importe quand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">N'importe quand</SelectItem>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="endHour" className="text-sm">Heure de fin</Label>
                <Select value={localFilters.endHour || "any"} onValueChange={(value) => updateFilter('endHour', value === "any" ? "" : value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="N'importe quand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">N'importe quand</SelectItem>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Location and Staff Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="salon" className="text-sm font-medium">Salon</Label>
              <Select value={localFilters.salonId || "all"} onValueChange={(value) => updateFilter('salonId', value === "all" ? "" : value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Tous les salons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les salons</SelectItem>
                  {salons.map((salon) => (
                    <SelectItem key={salon.id} value={salon.id}>
                      {salon.name} - {salon.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="staff" className="text-sm font-medium">Membre du personnel</Label>
              <Select 
                value={localFilters.staffId || "all"} 
                onValueChange={(value) => updateFilter('staffId', value === "all" ? "" : value)}
                disabled={!filteredStaff.length}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={filteredStaff.length ? "Tout le personnel" : "Sélectionner d'abord un salon"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout le personnel</SelectItem>
                  {filteredStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}