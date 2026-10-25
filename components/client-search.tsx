"use client"

import type React from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus } from "lucide-react"
import { useState } from "react"

interface ClientSearchProps {
  onSearch: (query: string) => void
  onCreate?: () => void
}

export function ClientSearch({ onSearch, onCreate }: ClientSearchProps) {
  const [query, setQuery] = useState("")

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    onSearch(value)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Rechercher des clients..." value={query} onChange={handleSearch} className="pl-10" />
      </div>
      {onCreate && <Button type="button" className="gap-2" onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Ajouter un client
      </Button>}
    </div>
  )
}
