"use client"

import type React from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus } from "lucide-react"
import { useState } from "react"

interface ClientSearchProps {
  onSearch: (query: string) => void
}

export function ClientSearch({ onSearch }: ClientSearchProps) {
  const [query, setQuery] = useState("")

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    onSearch(value)
  }

  return (
    <div className="flex gap-2">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search clients..." value={query} onChange={handleSearch} className="pl-10" />
      </div>
      <Button className="gap-2">
        <Plus className="w-4 h-4" />
        Add Client
      </Button>
    </div>
  )
}
