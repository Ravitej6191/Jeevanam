import { useRef } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import type { PhotoItem } from '@/hooks/use-photos'

interface PhotoPickerProps {
  photos: PhotoItem[]
  onAdd: (files: File[]) => void
  onRemove: (key: string) => void
  label?: string
}

export function PhotoPicker({ photos, onAdd, onRemove, label = 'Photos (optional)' }: PhotoPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) onAdd(files)
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />

      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.key} className="relative">
              <img src={photo.url} alt="Attachment" className="aspect-square w-full rounded-lg border border-border object-cover" />
              <button
                type="button"
                onClick={() => onRemove(photo.key)}
                aria-label="Remove photo"
                className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-danger text-danger-foreground shadow-sm"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
        >
          <Camera className="size-4" />
          Take Photo
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
        >
          <ImagePlus className="size-4" />
          Upload Images
        </button>
      </div>
    </div>
  )
}
