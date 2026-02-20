"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { ReactNode, CSSProperties } from "react"

interface DraggableAppointmentProps {
  id: string
  appointment: any
  children: ReactNode
  disabled?: boolean
  style?: CSSProperties
  className?: string
}

export function DraggableAppointment({
  id,
  appointment,
  children,
  disabled = false,
  style: externalStyle,
  className = "",
}: DraggableAppointmentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { appointment },
    disabled,
  })

  const combinedStyle: CSSProperties = {
    ...externalStyle,
    ...(transform
      ? {
          transform: CSS.Transform.toString(transform),
          opacity: isDragging ? 0.5 : 1,
          zIndex: isDragging ? 1000 : (externalStyle?.zIndex ?? 10),
        }
      : {
          zIndex: externalStyle?.zIndex ?? 10,
        }),
    cursor: disabled ? "pointer" : isDragging ? "grabbing" : "grab",
  }

  return (
    <div
      ref={setNodeRef}
      style={combinedStyle}
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      className={`${className} ${isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
    >
      {children}
    </div>
  )
}
