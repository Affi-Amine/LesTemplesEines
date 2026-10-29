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
  disabled?: boolean
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
  disabled = false,
}: DroppableSlotProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: { hour, minute, staffId, date },
    disabled,
  })

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!disabled && e.target === e.currentTarget && onEmptyClick) {
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
      data-calendar-slot={id}
      data-drop-over={isOver}
      data-drop-invalid={isInvalidDrop}
      onClick={handleClick}
      aria-disabled={disabled || undefined}
      className={`${className} ${dragClass} ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"} transition-colors`}
    >
      {children}
    </div>
  )
}
