import { useState } from 'react'
import { Check, Loader2, MessageCircle } from 'lucide-react'
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

/**
 * Phone version of a broadcast. The phone can't reach the PC's WhatsApp
 * server, so each tenant gets a button that opens WhatsApp with the message
 * ready — the owner taps send there, then comes back for the next one.
 */
export function WhatsAppSendList({ recipients, message, isFinishing, onFinish, onBack }: WhatsAppSendListProps) {
  const [opened, setOpened] = useState<Set<string>>(new Set())

  const open = (recipient: SendRecipient) => {
    setOpened((prev) => new Set(prev).add(recipient.id))
    void openWhatsAppChat(recipient.phone, message)
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Send on WhatsApp</p>
        <p className="text-sm text-muted-foreground">
          Tap a tenant to open WhatsApp with your message ready, press send there, then come back for the next one.
        </p>
      </div>

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
        <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={isFinishing}>
          Back
        </Button>
        <Button type="button" className="flex-1" onClick={() => onFinish(opened.size)} disabled={isFinishing}>
          {isFinishing ? <Loader2 className="size-4 animate-spin" /> : null}
          Done ({opened.size}/{recipients.length})
        </Button>
      </div>
    </div>
  )
}
