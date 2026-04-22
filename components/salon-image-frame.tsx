"use client"

import { cn } from "@/lib/utils"

interface SalonImageFrameProps {
  src: string
  alt: string
  className?: string
  imageClassName?: string
  backgroundClassName?: string
  draggable?: boolean
}

export function SalonImageFrame({
  src,
  alt,
  className,
  imageClassName,
  backgroundClassName,
  draggable = false,
}: SalonImageFrameProps) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,rgba(35,28,22,0.92),rgba(18,15,12,0.96))]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={cn("absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl", backgroundClassName)}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(8,7,6,0.08)_58%,rgba(8,7,6,0.35)_100%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        className={cn("relative z-10 h-full w-full object-contain", imageClassName)}
      />
    </div>
  )
}
