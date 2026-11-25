import { useEffect, useState } from 'react'
import { PartyPopper } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/auth-context'
import { useBuildingData } from '@/features/building/hooks/use-building-data'
import { isWelcomeSeen, markWelcomeSeen } from './welcome-seen'

export function WelcomeDrawer({ onDismiss }: { onDismiss?: () => void }) {
  const { user } = useAuth()
  const { data: building } = useBuildingData()
  const [open, setOpen] = useState(false)
  const ownerFirstName = building?.building.ownerName?.split(' ')[0] || user?.name.split(' ')[0]

  useEffect(() => {
    if (!isWelcomeSeen()) {
      setOpen(true)
    }
  }, [])

  const dismiss = () => {
    markWelcomeSeen()
    setOpen(false)
    onDismiss?.()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PartyPopper className="size-6" />
          </div>
          <SheetTitle className="text-center text-lg">
            {ownerFirstName ? `Welcome, ${ownerFirstName}!` : 'Welcome to Jeevanam'}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <p className="text-center text-sm text-muted-foreground">
            Glad to have you here. Let's get started.
          </p>
          <Button className="w-full" onClick={dismiss}>
            Let's go
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
