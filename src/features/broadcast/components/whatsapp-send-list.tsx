import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Check, Loader2, MessageCircle, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openWhatsAppChat } from '../open-whatsapp'

export interface SendRecipient {
  id: string
  name: string
  phone: string
}

interface WhatsAppSendListProps {
  recipients: SendRecipient[]
  message: string
  isFinishing: boolean
  onFinish: (openedCount: number) => void
  onBack: () => void
}

/** Pause after coming back from WhatsApp, so the owner can tap Stop. */
const NEXT_DELAY_MS = 1500

/**
 * Phone version of a broadcast. The phone can't reach the PC's WhatsApp
 * server, so each tenant's chat is opened in WhatsApp with the message ready
 * and the owner taps send there. "Send to everyone" chains them: coming back
 * to the app opens the next tenant's chat on its own.
 */
export function WhatsAppSendList({ recipients, message, isFinishing, onFinish, onBack }: WhatsAppSendListProps) {
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const openedRef = useRef(opened)
  openedRef.current = opened

  const open = useCallback(
    (recipient: SendRecipient) => {
      setOpened((prev) => new Set(prev).add(recipient.id))
      void openWhatsAppChat(recipient.phone, message)
    },
    [message],
  )

  const nextUnopened = useCallback(
    () => recipients.find((r) => !openedRef.current.has(r.id)),
    [recipients],
  )

  const start = () => {
    const next = nextUnopened()
    if (!next) return
    setRunning(true)
    open(next)
  }

  // While running: each time the app comes back to the front, open the next chat.
  useEffect(() => {
    if (!running) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return
      timer = setTimeout(() => {
        const next = nextUnopened()
        if (next) open(next)
        else setRunning(false)
      }, NEXT_DELAY_MS)
    })
    return () => {
      if (timer) clearTimeout(timer)
      void listenerPromise.then((listener) => listener.remove())
    }
  }, [running, nextUnopened, open])

  const allOpened = opened.size >= recipients.length

  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Send on WhatsApp</p>
        <p className="text-sm text-muted-foreground">
          Press send in WhatsApp, then go back to this app. With “Send to everyone”, the next tenant opens on its own.
        </p>
      </div>

      {running ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => setRunning(false)}>
          <Square className="size-4" />
          Stop ({opened.size}/{recipients.length} opened)
        </Button>
      ) : (
        <Button type="button" className="w-full" onClick={start} disabled={allOpened || isFinishing}>
          <Play className="size-4" />
          {opened.size === 0 ? 'Send to everyone' : allOpened ? 'All opened' : 'Continue with the rest'}
        </Button>
      )}

      <div className="space-y-2">
        {recipients.map((recipient) => {
          const done = opened.has(recipient.id)
          return (
            <div
              key={recipient.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{recipient.name}</p>
                <p className="text-xs text-muted-foreground">{recipient.phone}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={done ? 'outline' : 'default'}
                disabled={running}
                onClick={() => open(recipient)}
              >
                {done ? <Check className="size-4 text-success" /> : <MessageCircle className="size-4" />}
                {done ? 'Open again' : 'Send'}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={isFinishing || running}>
          Back
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={() => onFinish(opened.size)}
          disabled={isFinishing || running}
        >
          {isFinishing ? <Loader2 className="size-4 animate-spin" /> : null}
          Done ({opened.size}/{recipients.length})
        </Button>
      </div>
    </div>
  )
}
