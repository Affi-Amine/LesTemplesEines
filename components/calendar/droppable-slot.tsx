"use client"

import { useDroppable } from "@dnd-kit/core"
import { ReactNode, MouseEvent } from "react"

interface DroppableSlotProps {
  id: string
  hour: number
  minute?: number
  staffId?: string
  date: Date
  children: ReactNode
  onEmptyClick?: (data: { hour: number; minute: number; staffId?: string; date: Date }) => void
  className?: string
  isInvalidDrop?: boolean
  isDragActive?: boolean
}

export function DroppableSlot({
  id,
  hour,
  minute = 0,
  staffId,
  date,
  children,
  onEmptyClick,
  className = "",
  isInvalidDrop = false,
  isDragActive = false,
}: DroppableSlotProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: { hour, minute, staffId, date },
  })

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onEmptyClick) {
      onEmptyClick({
        hour,
        minute,
        staffId,
        date,
      })
    }
  }

  const dragClass = isOver && active
    ? (isInvalidDrop
      ? "bg-destructive/15 ring-2 ring-destructive ring-inset"
      : "bg-primary/20 ring-2 ring-primary ring-inset")
    : (isDragActive && isInvalidDrop ? "bg-destructive/10" : "")

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`${className} ${dragClass} cursor-pointer transition-colors hover:bg-muted/30`}
    >
      {children}
    </div>
  )
}
