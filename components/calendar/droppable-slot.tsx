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
}: DroppableSlotProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: { hour, minute, staffId, date },
  })

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    // Only trigger if clicking directly on this element (not on appointments)
    if (e.target === e.currentTarget && onEmptyClick) {
      // Calculate minute based on click position within the slot
      const rect = e.currentTarget.getBoundingClientRect()
      const clickY = e.clientY - rect.top
      const slotHeight = rect.height
      const clickedMinute = Math.floor((clickY / slotHeight) * 60)

      onEmptyClick({
        hour,
        minute: clickedMinute,
        staffId,
        date,
      })
    }
  }

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`${className} ${
        isOver && active ? "bg-primary/20 ring-2 ring-primary ring-inset" : ""
      } cursor-pointer transition-colors hover:bg-muted/30`}
    >
      {children}
    </div>
  )
}
