import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useBuildingData } from '@/features/building/hooks/use-building-data'
import { useAuth } from '@/providers/auth-context'
import { digitsOnly } from '@/utils/format'
import { updateProfile } from '../services/onboarding.service'

const PHONE_REGEX = /^[6-9]\d{9}$/
const DEFAULT_NAME = 'My Residency'

const schema = z.object({
  buildingName: z.string().trim().min(2, 'Enter your residency name').max(80, 'Name is too long'),
  phone: z.string().refine((v) => v === '' || PHONE_REGEX.test(v), 'Enter a valid 10-digit mobile number'),
  address: z.string().trim().max(200, 'Address is too long'),
})

type Values = z.infer<typeof schema>

function doneKey(userId: string) {
  return `jeevanam.profilePrompt.${userId}`
}

function isDone(userId: string): boolean {
  try {
    return localStorage.getItem(doneKey(userId)) === 'true'
  } catch {
    return true
  }
}

function markDone(userId: string) {
  try {
    localStorage.setItem(doneKey(userId), 'true')
  } catch {
    // ignore
  }
}

/**
 * One-time prompt for a new owner's residency details, shown after the
 * welcome drawer. Only appears while the profile is still the auto-created
 * default (no real name or address yet), and never again once saved or skipped.
 */
export function ProfilePromptDrawer({ ready }: { ready: boolean }) {
  const { user } = useAuth()
  const { data } = useBuildingData()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const shown = useRef(false)

  const building = data?.building
  const incomplete = building ? building.name.trim() === DEFAULT_NAME || building.address.trim() === '' : false

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { buildingName: '', phone: '', address: '' } })

  useEffect(() => {
    if (!ready || !user || !building || !incomplete || shown.current || isDone(user.id)) return
    shown.current = true
    reset({
      buildingName: building.name.trim() === DEFAULT_NAME ? '' : building.name,
      phone: building.contactPhone || user.phone || '',
      address: building.address,
    })
    setOpen(true)
  }, [ready, user, building, incomplete, reset])

  const close = () => {
    if (user) markDone(user.id)
    setOpen(false)
  }

  const onSubmit = async (values: Values) => {
    if (!building || !user) return
    setIsSaving(true)
    try {
      await updateProfile({
        propertyType: building.propertyType,
        buildingName: values.buildingName,
        address: values.address,
        city: building.city,
        state: building.state,
        pincode: building.pincode,
        ownerName: building.ownerName || user.name,
        phone: values.phone,
        email: building.contactEmail || user.email,
      })
      await queryClient.invalidateQueries({ queryKey: ['building'] })
      toast.success('Profile saved')
      close()
    } catch {
      toast.error('Could not save your details. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-6" />
          </div>
          <SheetTitle className="text-center text-lg">Tell us about your residency</SheetTitle>
          <SheetDescription className="text-center">
            This appears on your profile. You can change it anytime in Settings.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4 pb-8">
          <div className="space-y-1.5">
            <Label htmlFor="prompt-name">
              Residency name
              <span className="text-danger" aria-hidden="true">
                {' '}
                *
              </span>
            </Label>
            <Input id="prompt-name" maxLength={80} placeholder="e.g. Sai Nilayam" {...register('buildingName')} />
            {errors.buildingName ? <p className="text-xs text-danger">{errors.buildingName.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt-phone">Mobile number</Label>
            <Input
              id="prompt-phone"
              inputMode="numeric"
              maxLength={10}
              {...register('phone', {
                onChange: (e) => {
                  e.target.value = digitsOnly(e.target.value, 10)
                },
              })}
            />
            {errors.phone ? <p className="text-xs text-danger">{errors.phone.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt-address">Address</Label>
            <Input id="prompt-address" maxLength={200} {...register('address')} />
            {errors.address ? <p className="text-xs text-danger">{errors.address.message}</p> : null}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={close} disabled={isSaving}>
              Skip for now
            </Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
