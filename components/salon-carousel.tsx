"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"
import { Button } from "@/components/ui/button"
import { Icon } from "@iconify/react"
import { cn } from "@/lib/utils"

interface SalonCarouselProps {
  images: string[]
  alt: string
  className?: string
  autoplay?: boolean
  showNavigation?: boolean
  showDots?: boolean
}

export function SalonCarousel({
  images,
  alt,
  className,
  autoplay = true,
  showNavigation = true,
  showDots = true
}: SalonCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  // Create autoplay plugin with useRef to maintain instance
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 5000,
      stopOnInteraction: false,
      stopOnMouseEnter: true
    })
  )

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: false, align: "start" },
    autoplay ? [autoplayPlugin.current] : []
  )

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index)
  }, [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return

    onSelect()
    emblaApi.on("select", onSelect)
    emblaApi.on("reInit", onSelect)

    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("reInit", onSelect)
    }
  }, [emblaApi, onSelect])

  // If no images or only one, show single image without carousel functionality
  if (!images || images.length === 0) {
    return (
      <div className={cn("relative w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 flex items-center justify-center", className)}>
        <Icon icon="solar:buildings-3-bold" className="w-32 h-32 text-primary/30" />
      </div>
    )
  }

  if (images.length === 1) {
    return (
      <div className={cn("relative w-full h-full temple-frame rounded-[1.75rem] overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[0]}
          alt={alt}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div className={cn("relative w-full h-full group temple-frame rounded-[1.75rem] overflow-hidden", className)}>
      {/* Carousel Container */}
      <div className="overflow-hidden h-full" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {images.map((image, index) => (
            <div
              key={index}
              className="flex-[0_0_100%] min-w-0 h-full relative"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={`${alt} - Image ${index + 1}`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows - Desktop Only, Theme Aligned */}
      {showNavigation && images.length > 1 && (
        <>
          {/* Left Arrow */}
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2",
              "hidden md:flex", // Desktop only
              "h-12 w-12 rounded-full",
              "bg-background/82 hover:bg-background",
              "border-primary/25 hover:border-primary",
              "text-foreground hover:text-primary",
              "shadow-lg hover:shadow-xl",
              "transition-all duration-200",
              "cursor-pointer",
              "backdrop-blur-sm",
              "disabled:cursor-not-allowed disabled:opacity-35"
            )}
            onClick={scrollPrev}
            aria-label="Image précédente"
            disabled={!canScrollPrev}
          >
            <Icon icon="solar:alt-arrow-left-bold" className="h-6 w-6" />
          </Button>

          {/* Right Arrow */}
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2",
              "hidden md:flex", // Desktop only
              "h-12 w-12 rounded-full",
              "bg-background/82 hover:bg-background",
              "border-primary/25 hover:border-primary",
              "text-foreground hover:text-primary",
              "shadow-lg hover:shadow-xl",
              "transition-all duration-200",
              "cursor-pointer",
              "backdrop-blur-sm",
              "disabled:cursor-not-allowed disabled:opacity-35"
            )}
            onClick={scrollNext}
            aria-label="Image suivante"
            disabled={!canScrollNext}
          >
            <Icon icon="solar:alt-arrow-right-bold" className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Dots Pagination */}
      {showDots && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/38 backdrop-blur-sm px-3 py-2 rounded-full border border-primary/20">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "rounded-full transition-all cursor-pointer",
                selectedIndex === index
                  ? "bg-primary w-4 h-2"
                  : "bg-foreground/50 hover:bg-foreground/75 w-2 h-2"
              )}
              aria-label={`Aller à l'image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image Counter */}
      <div className="absolute top-4 right-4 bg-background/70 backdrop-blur-sm text-foreground text-sm px-3 py-1 rounded-full border border-primary/25">
        {selectedIndex + 1} / {images.length}
      </div>
    </div>
  )
}
