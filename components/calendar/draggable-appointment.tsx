"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { ReactNode, CSSProperties, useEffect, useId, useRef } from "react"

interface DraggableAppointmentProps {
  id: string
  appointment: any
  children: ReactNode
  disabled?: boolean
  style?: CSSProperties
  className?: string
  /** Opening the booking on a plain tap, while a held drag moves it. */
  onClick?: () => void
}

export function DraggableAppointment({
  id,
  appointment,
  children,
  disabled = false,
  style: externalStyle,
  className = "",
  onClick,
}: DraggableAppointmentProps) {
  const instance = useId()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    // Duo appointments have one representation per staff column.
    id: `${id}:${instance}`,
    data: { appointment },
    disabled,
  })

  // A drop fires a click on some browsers; that one must not open the booking.
  const dragged = useRef(false)
  useEffect(() => { if (isDragging) dragged.current = true }, [isDragging])
  const handleClick = () => {
    if (dragged.current) { dragged.current = false; return }
    onClick?.()
  }

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
      data-appointment-id={id}
      style={combinedStyle}
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      {...(onClick ? { onClick: handleClick } : {})}
      className={`${className} ${isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
    >
      {children}
    </div>
  )
}
