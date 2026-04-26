"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Icon } from "@iconify/react"
import { SalonImageFrame } from "@/components/salon-image-frame"

interface MultiImageUploadProps {
  value: string[]
  onChange: (urls: string[]) => void
  disabled?: boolean
  bucketName?: string
  maxImages?: number
}

export function MultiImageUpload({
  value = [],
  onChange,
  disabled,
  bucketName = "salon-images",
  maxImages = 10
}: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Check if adding these files would exceed max
    if (value.length + files.length > maxImages) {
      toast.error("Limite d'images atteinte", {
        description: `Vous pouvez ajouter maximum ${maxImages} images`,
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />
      })
      return
    }

    const filesToUpload = Array.from(files)

    // Validate all files first
    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) {
        toast.error("Format de fichier non supporté", {
          description: "Veuillez sélectionner des images (JPG, PNG, WebP)",
          icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />
        })
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Fichier trop volumineux", {
          description: `${file.name} dépasse la taille maximale de 5MB`,
          icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />
        })
        return
      }
    }

    try {
      setIsUploading(true)
      const uploadedUrls: string[] = []

      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucketName', bucketName)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const data = await response.json()
        uploadedUrls.push(data.url)
      }

      onChange([...value, ...uploadedUrls])
      toast.success(`${uploadedUrls.length} image(s) téléchargée(s)`, {
        icon: <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />
      })
    } catch (error: any) {
      console.error("Upload error:", error)
      toast.error("Erreur lors du téléchargement", {
        description: error.message || "Une erreur est survenue",
        icon: <Icon icon="solar:danger-bold" className="w-5 h-5 text-red-500" />
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemove = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index)
    onChange(newUrls)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newUrls = [...value]
    const temp = newUrls[index - 1]
    newUrls[index - 1] = newUrls[index]
    newUrls[index] = temp
    onChange(newUrls)
  }

  const handleMoveDown = (index: number) => {
    if (index === value.length - 1) return
    const newUrls = [...value]
    const temp = newUrls[index + 1]
    newUrls[index + 1] = newUrls[index]
    newUrls[index] = temp
    onChange(newUrls)
  }

  return (
    <div className="space-y-4 w-full">
      {/* Image Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {value.map((url, index) => (
            <div key={index} className="relative aspect-video overflow-hidden rounded-lg border bg-muted group">
              {(url.startsWith('/') || url.includes('supabase.co')) ? (
                <SalonImageFrame
                  src={url}
                  alt={`Image ${index + 1}`}
                  className="h-full w-full"
                  imageClassName="px-2 py-2"
                />
              ) : (
                <SalonImageFrame
                  src={url}
                  alt={`Image ${index + 1}`}
                  className="h-full w-full"
                  imageClassName="px-2 py-2"
                />
              )}

              {/* Image number badge */}
              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>

              <Button
                type="button"
                onClick={() => handleRemove(index)}
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 z-10 h-8 w-8 shadow-sm"
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Controls overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {/* Move buttons */}
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled || index === 0}
                  >
                    <Icon icon="solar:alt-arrow-up-linear" className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled || index === value.length - 1}
                  >
                    <Icon icon="solar:alt-arrow-down-linear" className="h-4 w-4" />
                  </Button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {value.length < maxImages && (
        <div
          className="flex aspect-video max-h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:bg-muted transition-colors"
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Téléchargement en cours...</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <p className="text-sm font-medium">Cliquez pour ajouter des images</p>
                <p className="text-xs">JPG, PNG, WebP (max 5MB chacune) - {value.length}/{maxImages} images</p>
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />
    </div>
  )
}
