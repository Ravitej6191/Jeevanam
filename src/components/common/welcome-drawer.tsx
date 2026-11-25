import { useEffect, useState } from 'react'
import { PartyPopper } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/auth-context'
import { useBuildingData } from '@/features/building/hooks/use-building-data'
import { canSendSms, requestSmsPermission } from '@/lib/sms'
import { isWelcomeSeen, markWelcomeSeen } from './welcome-seen'

export function WelcomeDrawer({ onDismiss }: { onDismiss?: () => void }) {
  const { user } = useAuth()
  const { data: building } = useBuildingData()
  const [open, setOpen] = useState(false)
  const ownerFirstName = building?.building.ownerName?.split(' ')[0] || user?.name.split(' ')[0]
  const asksForSms = canSendSms()

  useEffect(() => {
    if (!isWelcomeSeen()) {
      setOpen(true)
    }
  }, [])

  const dismiss = () => {
    markWelcomeSeen()
    setOpen(false)
    // Ask for the phone permission the app needs right away, so the owner isn't
    // surprised by it later. The next drawer waits until Android's own prompt closes.
    void (asksForSms ? requestSmsPermission() : Promise.resolve()).finally(() => onDismiss?.())
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <SheetContent side="bottom" className="gap-0 rounded-t-xl px-6 pt-2 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="items-center gap-0 p-0 pt-5 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PartyPopper className="size-7" />
          </div>
          <SheetTitle className="mt-4 text-xl">
            {ownerFirstName ? `Welcome, ${ownerFirstName}!` : 'Welcome to Jeevanam'}
          </SheetTitle>
          <SheetDescription className="mt-2">Glad to have you here. Let's get started.</SheetDescription>
        </SheetHeader>

        {asksForSms ? (
          <p className="mt-5 rounded-lg bg-muted/60 px-3.5 py-3 text-center text-xs leading-relaxed text-muted-foreground">
            Next, Android will ask to allow SMS. Jeevanam uses it only to text your tenants when you send a message from the app.
          </p>
        ) : null}

        <Button className="mt-6 w-full" onClick={dismiss}>
          Let's go
        </Button>
      </SheetContent>
    </Sheet>
  )
}
