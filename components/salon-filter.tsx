"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSalons } from "@/lib/hooks/use-salons"

interface SalonFilterProps {
  selectedSalonId: string
  onSelectSalon: (salonId: string) => void
  className?: string
}

export function SalonFilter({ selectedSalonId, onSelectSalon, className }: SalonFilterProps) {
  const { data: salons } = useSalons()

  return (
    <div className={className}>
      <Select value={selectedSalonId} onValueChange={onSelectSalon}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Filtrer par salon" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les salons</SelectItem>
          {salons?.map((salon) => (
            <SelectItem key={salon.id} value={salon.id}>
              {salon.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
