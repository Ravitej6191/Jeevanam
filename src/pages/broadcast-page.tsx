import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBuildingData } from '@/features/building/hooks/use-building-data'
import { logBroadcast, sendBroadcast } from '@/features/broadcast/services/broadcast.service'
import { WhatsAppSendList, type SendRecipient } from '@/features/broadcast/components/whatsapp-send-list'
import { uploadTenantFile } from '@/lib/storage'
import type { Tenant } from '@/types/domain'
import { usePageTitle } from '@/hooks/use-page-title'

const broadcastSchema = z.object({
  message: z.string().min(2, 'Enter a message'),
  audience: z.string().min(1),
})

type BroadcastFormValues = z.infer<typeof broadcastSchema>

export function BroadcastPage() {
  const navigate = useNavigate()
  const onBack = useCallback(() => navigate(-1), [navigate])
  usePageTitle('Broadcast a Message', onBack)

  const { data: building } = useBuildingData()
  const queryClient = useQueryClient()
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [phoneSend, setPhoneSend] = useState<{ recipients: SendRecipient[]; text: string; imageUrl: string | null; label: string; rawMessage: string } | null>(null)
  const isNative = Capacitor.isNativePlatform()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setImageFile(file)
    setImagePreview(objectUrl)
  }

  const handleRemoveImage = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setImageFile(null)
    setImagePreview(null)
  }

  const allTenants = useMemo(() => {
    const list: (Tenant & { floorId: string })[] = []
    for (const floor of building?.floors ?? []) {
      for (const house of floor.houses) {
        if (house.tenant) list.push({ ...house.tenant, floorId: floor.id })
      }
    }
    return list
  }, [building])

  const audienceGroups = useMemo(() => {
    const general = [
      { value: 'all', label: 'All Tenants' },
      { value: 'pending_rent', label: 'Pending Rent' },
      { value: 'pending_deposit', label: 'Pending Deposit' },
    ]
    const floors = (building?.floors ?? []).map((f) => ({ value: `floor:${f.id}`, label: f.name }))
    const tenants = allTenants
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ value: `tenant:${t.id}`, label: `${t.name} · House ${t.houseNumber}` }))
    return { general, floors, tenants }
  }, [building, allTenants])

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BroadcastFormValues>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: { message: '', audience: 'all' },
  })

  const resolveAudience = (audience: string): { tenants: Tenant[]; label: string } => {
    if (audience === 'all') return { tenants: allTenants, label: 'All Tenants' }
    if (audience === 'pending_rent') {
      return { tenants: allTenants.filter((t) => t.rentStatus !== 'paid'), label: 'Pending Rent' }
    }
    if (audience === 'pending_deposit') {
      return { tenants: allTenants.filter((t) => !t.depositRecord), label: 'Pending Deposit' }
    }
    if (audience.startsWith('floor:')) {
      const floorId = audience.slice('floor:'.length)
      const floor = building?.floors.find((f) => f.id === floorId)
      return { tenants: allTenants.filter((t) => t.floorId === floorId), label: floor?.name ?? 'Floor' }
    }
    if (audience.startsWith('tenant:')) {
      const tenant = allTenants.find((t) => t.id === audience.slice('tenant:'.length))
      return { tenants: tenant ? [tenant] : [], label: tenant?.name ?? 'Tenant' }
    }
    return { tenants: [], label: 'Unknown' }
  }

  const finishPhoneSend = useMutation({
    mutationFn: async (openedCount: number) => {
      if (!phoneSend) return
      await logBroadcast({
        message: phoneSend.rawMessage,
        imageUrl: phoneSend.imageUrl,
        audience: phoneSend.label,
        recipientCount: phoneSend.recipients.length,
        deliveredCount: openedCount,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Broadcast saved')
      navigate(-1)
    },
    onError: () => toast.error('Could not save the broadcast. Please try again.'),
  })

  const mutation = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      if (result.recipientCount === 0) {
        toast.warning('No tenants matched this audience — nothing was sent.')
      } else if (result.deliveredCount === result.recipientCount) {
        toast.success(`Sent to ${result.deliveredCount} tenant${result.deliveredCount === 1 ? '' : 's'}`)
      } else {
        toast.warning(`Delivered to ${result.deliveredCount}/${result.recipientCount} — some numbers failed`)
      }
      reset()
      handleRemoveImage()
      navigate(-1)
    },
    onError: () => toast.error('Could not send the broadcast. Please try again.'),
  })

  const onSubmit = async (values: BroadcastFormValues) => {
    let imageUrl = imageFile ? null : imagePreview
    if (imageFile) {
      setIsUploadingImage(true)
      try {
        imageUrl = await uploadTenantFile(imageFile, 'broadcast-images')
      } catch {
        toast.error('Could not upload the image. Please try again.')
        setIsUploadingImage(false)
        return
      }
      setIsUploadingImage(false)
    }
    const { tenants, label } = resolveAudience(values.audience)
    if (tenants.length === 0) {
      toast.warning('No tenants matched this audience — nothing was sent.')
      return
    }
    if (isNative) {
      const seen = new Set<string>()
      const recipients = tenants
        .filter((t) => !seen.has(t.phone) && seen.add(t.phone))
        .map((t) => ({ id: t.id, name: t.name, phone: t.phone }))
      // WhatsApp links carry text only, so a photo goes along as a link.
      const text = imageUrl ? `${values.message}\n${imageUrl}` : values.message
      setPhoneSend({ recipients, text, imageUrl, label, rawMessage: values.message })
      return
    }
    mutation.mutate({ message: values.message, imageUrl, audience: label, recipients: tenants.map((t) => t.phone) })
  }

  if (phoneSend) {
    return (
      <WhatsAppSendList
        recipients={phoneSend.recipients}
        message={phoneSend.text}
        isFinishing={finishPhoneSend.isPending}
        onFinish={(openedCount) => finishPhoneSend.mutate(openedCount)}
        onBack={() => setPhoneSend(null)}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-8">
      <div className="space-y-1.5">
        <Label>Audience</Label>
        <Controller
          name="audience"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {audienceGroups.general.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {audienceGroups.floors.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>By Floor</SelectLabel>
                    {audienceGroups.floors.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {audienceGroups.tenants.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Tenants</SelectLabel>
                    {audienceGroups.tenants.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" rows={5} placeholder="Write your message..." {...register('message')} />
        {errors.message ? <p className="text-xs text-danger">{errors.message.message}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label>Image (optional)</Label>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        {imagePreview ? (
          <div className="relative w-fit">
            <img src={imagePreview} alt="Broadcast attachment" className="h-32 rounded-lg border border-border/70 object-cover" />
            <button
              type="button"
              onClick={handleRemoveImage}
              aria-label="Remove image"
              className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-danger text-danger-foreground shadow-sm"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 py-4 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
            >
              <Camera className="size-4" />
              Take Photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 py-4 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
            >
              <ImagePlus className="size-4" />
              Upload Image
            </button>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={mutation.isPending || isUploadingImage}>
        {mutation.isPending || isUploadingImage ? <Loader2 className="size-4 animate-spin" /> : null}
        {isNative ? 'Continue' : 'Send Broadcast'}
      </Button>
    </form>
  )
}
