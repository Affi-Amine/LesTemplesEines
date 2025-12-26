"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Image as ImageIcon, Upload, X, Loader2 } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  disabled?: boolean
  bucketName?: string
}

export function ImageUpload({ 
  value, 
  onChange, 
  disabled, 
  bucketName = "salon-images" 
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Format de fichier non supporté", {
        description: "Veuillez sélectionner une image (JPG, PNG, WebP)"
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux", {
        description: "La taille maximale est de 5MB"
      })
      return
    }

    try {
      setIsUploading(true)
      
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
      onChange(data.url)
      toast.success("Image téléchargée avec succès")
    } catch (error: any) {
      console.error("Upload error:", error)
      toast.error("Erreur lors du téléchargement", {
        description: error.message || "Une erreur est survenue"
      })
    } finally {
      setIsUploading(false)
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemove = () => {
    onChange("")
  }

  return (
    <div className="space-y-4 w-full">
      {value ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          {/* Use standard img tag if URL is not relative and not from our Supabase project to prevent Next.js crashes */}
          {(value.startsWith('/') || value.includes('supabase.co')) ? (
            <Image
              fill
              src={value}
              alt="Upload preview"
              className="object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Upload preview"
              className="h-full w-full object-cover"
            />
          )}
          <Button
            type="button"
            onClick={handleRemove}
            variant="destructive"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div 
          className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:bg-muted transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {isUploading ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <>
                <Upload className="h-10 w-10" />
                <p className="text-sm font-medium">Cliquez pour télécharger une image</p>
                <p className="text-xs">JPG, PNG, WebP (max 5MB)</p>
              </>
            )}
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />
    </div>
  )
}
