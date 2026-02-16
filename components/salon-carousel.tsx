"use client"

import { useState, useCallback, useEffect } from "react"
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

  const autoplayPlugin = Autoplay({
    delay: 5000,
    stopOnInteraction: false,
    stopOnMouseEnter: true
  })

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true },
    autoplay ? [autoplayPlugin] : []
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
      <div className={cn("relative w-full h-full", className)}>
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
    <div className={cn("relative w-full h-full group", className)}>
      {/* Carousel Container */}
      <div className="overflow-hidden h-full" ref={emblaRef}>
        <div className="flex h-full">
          {images.map((image, index) => (
            <div key={index} className="flex-[0_0_100%] min-w-0 h-full relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={`${alt} - Image ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      {showNavigation && images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={scrollPrev}
          >
            <Icon icon="solar:alt-arrow-left-bold" className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={scrollNext}
          >
            <Icon icon="solar:alt-arrow-right-bold" className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Dots Pagination */}
      {showDots && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all cursor-pointer",
                selectedIndex === index
                  ? "bg-white w-4"
                  : "bg-white/50 hover:bg-white/75"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image Counter */}
      <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
        {selectedIndex + 1} / {images.length}
      </div>
    </div>
  )
}
