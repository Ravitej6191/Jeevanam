import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { sendSms, smsAvailability } from '@/lib/sms'

export interface SmsRecipient {
  id: string
  name: string
  phone: string
}

type Outcome = { state: 'pending' } | { state: 'sent' } | { state: 'failed'; error: string }

interface SmsSendSheetProps {
  open: boolean
  recipients: SmsRecipient[]
  message: string
  /** Called once with how many were sent when the owner closes the results. */
  onClose: (sentCount: number) => void
}

/** Pause between messages so the carrier doesn't mistake the burst for spam. */
const GAP_MS = 800

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sends one SMS per recipient from the phone, showing live progress, then the
 * result for each tenant with a retry for any that failed.
 */
export function SmsSendSheet({ open, recipients, message, onClose }: SmsSendSheetProps) {
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({})
  const [running, setRunning] = useState(false)
  const [blocker, setBlocker] = useState<string | null>(null)
  const runId = useRef(0)

  const run = async (targets: SmsRecipient[]) => {
    const id = ++runId.current
    setBlocker(null)
    setRunning(true)

    const availability = await smsAvailability()
    if (!availability.ok) {
      setBlocker(availability.error)
      setRunning(false)
      return
    }

    for (const [index, recipient] of targets.entries()) {
      if (runId.current !== id) return
      const result = await sendSms(recipient.phone, message)
      if (runId.current !== id) return
      if (!result.ok && result.permissionDenied) {
        setBlocker(
          'Jeevanam is not allowed to send SMS. Open Settings → Apps → Jeevanam → Permissions and allow SMS. On Android 13 or newer you may first need to open the app’s info page, tap the ⋮ menu and choose “Allow restricted settings”.',
        )
        setRunning(false)
        return
      }
      setOutcomes((prev) => ({
        ...prev,
        [recipient.id]: result.ok ? { state: 'sent' } : { state: 'failed', error: result.error },
      }))
      if (index < targets.length - 1) await sleep(GAP_MS)
    }
    setRunning(false)
  }

  useEffect(() => {
    if (!open) return
    setOutcomes(Object.fromEntries(recipients.map((r) => [r.id, { state: 'pending' } as Outcome])))
    void run(recipients)
    const stop = runId
    return () => {
      stop.current++ // stop a run that is still going if the sheet goes away
    }
    // run only when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const sent = recipients.filter((r) => outcomes[r.id]?.state === 'sent').length
  const failed = recipients.filter((r) => outcomes[r.id]?.state === 'failed')
  const finished = !running
  const progress = Math.min(sent + failed.length + 1, recipients.length)

  return (
    <Sheet open={open} onOpenChange={() => {}}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[88vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>
            {blocker ? 'Could not send' : running ? `Sending ${progress} of ${recipients.length}…` : `Sent to ${sent} of ${recipients.length}`}
          </SheetTitle>
          <SheetDescription>
            {blocker
              ? blocker
              : running
                ? 'Keep this screen open until it finishes.'
                : failed.length === 0
                  ? 'Everyone got your message.'
                  : 'Some messages did not go out. You can try those again.'}
          </SheetDescription>
        </SheetHeader>

        {!blocker ? (
          <div className="space-y-2 px-4">
            {recipients.map((recipient) => {
              const outcome = outcomes[recipient.id] ?? { state: 'pending' }
              return (
                <div key={recipient.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{recipient.name}</p>
                    {outcome.state === 'failed' ? <p className="text-xs text-danger">{outcome.error}</p> : null}
                  </div>
                  {outcome.state === 'sent' ? (
                    <Check className="size-4 text-success" aria-label="Sent" />
                  ) : outcome.state === 'failed' ? (
                    <X className="size-4 text-danger" aria-label="Failed" />
                  ) : running ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Waiting" />
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        <div className="flex gap-2 px-4 pb-8">
          {finished && failed.length > 0 && !blocker ? (
            <Button type="button" variant="outline" className="flex-1" onClick={() => void run(failed)}>
              Try failed again
            </Button>
          ) : null}
          {blocker ? (
            <Button type="button" variant="outline" className="flex-1" onClick={() => void run(recipients.filter((r) => outcomes[r.id]?.state !== 'sent'))}>
              Try again
            </Button>
          ) : null}
          <Button type="button" className="flex-1" disabled={running} onClick={() => onClose(sent)}>
            {running ? <Loader2 className="size-4 animate-spin" /> : null}
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
