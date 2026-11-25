import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquareText, Smartphone } from 'lucide-react'
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
import { ConfirmSheet } from '@/components/common/confirm-sheet'
import { EmptyState } from '@/components/common/empty-state'
import { useBuildingData } from '@/features/building/hooks/use-building-data'
import { logBroadcast } from '@/features/broadcast/services/broadcast.service'
import { SmsSendSheet, type SmsRecipient } from '@/features/broadcast/components/sms-send-sheet'
import { smsInfo } from '@/features/broadcast/sms-length'
import { canSendSms } from '@/lib/sms'
import type { Tenant } from '@/types/domain'
import { usePageTitle } from '@/hooks/use-page-title'

const broadcastSchema = z.object({
  message: z.string().trim().min(2, 'Enter a message').max(600, 'Keep the message under 600 characters'),
  audience: z.string().min(1),
})

type BroadcastFormValues = z.infer<typeof broadcastSchema>

interface PendingSend {
  recipients: SmsRecipient[]
  message: string
  audience: string
}

export function BroadcastPage() {
  const navigate = useNavigate()
  const onBack = useCallback(() => navigate(-1), [navigate])
  usePageTitle('Send SMS to Tenants', onBack)

  const { data: building } = useBuildingData()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<PendingSend | null>(null)
  const [sending, setSending] = useState<PendingSend | null>(null)

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
    watch,
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

  // One SMS per phone number, even if two tenants share a number.
  const toRecipients = (tenants: Tenant[]): SmsRecipient[] => {
    const seen = new Set<string>()
    return tenants
      .filter((t) => !seen.has(t.phone) && seen.add(t.phone))
      .map((t) => ({ id: t.id, name: t.name, phone: t.phone }))
  }

  const audienceValue = watch('audience')
  const messageValue = watch('message')
  const recipientCount = toRecipients(resolveAudience(audienceValue).tenants).length
  const info = smsInfo(messageValue.trim())

  const logMutation = useMutation({
    mutationFn: logBroadcast,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const onSubmit = (values: BroadcastFormValues) => {
    const { tenants, label } = resolveAudience(values.audience)
    const recipients = toRecipients(tenants)
    if (recipients.length === 0) {
      toast.warning('No tenants match this audience.')
      return
    }
    setConfirm({ recipients, message: values.message.trim(), audience: label })
  }

  const finishSending = (sentCount: number) => {
    const done = sending
    setSending(null)
    if (!done || sentCount === 0) return
    logMutation.mutate({
      message: done.message,
      imageUrl: null,
      audience: done.audience,
      recipientCount: done.recipients.length,
      deliveredCount: sentCount,
    })
    toast.success(`SMS sent to ${sentCount} tenant${sentCount === 1 ? '' : 's'}`)
    reset()
    navigate(-1)
  }

  if (!canSendSms()) {
    return (
      <EmptyState
        icon={Smartphone}
        title="Send SMS from the Android app"
        description="Text messages go out from your phone's SIM, so this works in the Jeevanam Android app, not in a browser."
      />
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-8">
        <div className="space-y-1.5">
          <Label>Send to</Label>
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
          <p className="text-xs text-muted-foreground">
            {recipientCount === 0
              ? 'No tenants match this choice.'
              : `${recipientCount} tenant${recipientCount === 1 ? '' : 's'} will get this message.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="message">Message</Label>
          <Textarea id="message" rows={5} placeholder="Write your message..." {...register('message')} />
          {errors.message ? <p className="text-xs text-danger">{errors.message.message}</p> : null}
          <p className="text-xs text-muted-foreground">
            {info.length} characters · {info.parts} SMS
            {info.unicode ? ' · special letters (like ₹ or Telugu) fit only 70 characters per SMS' : ''}
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={recipientCount === 0}>
          <MessageSquareText className="size-4" />
          Send SMS
        </Button>
      </form>

      <ConfirmSheet
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={confirm ? `Send SMS to ${confirm.recipients.length} tenant${confirm.recipients.length === 1 ? '' : 's'}?` : ''}
        description="The messages are sent from this phone's SIM. Your plan's normal SMS rates apply."
        confirmLabel="Send"
        destructive={false}
        onConfirm={() => {
          setSending(confirm)
          setConfirm(null)
        }}
      />

      <SmsSendSheet
        open={sending !== null}
        recipients={sending?.recipients ?? []}
        message={sending?.message ?? ''}
        onClose={finishSending}
      />
    </>
  )
}
