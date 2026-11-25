import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SpeedDialAction {
  label: string
  icon: LucideIcon
  /** Tailwind classes for the round icon button (background + text colour). */
  tone: string
  onClick: () => void
}

/** A floating "+" that fans out a few labelled quick actions when tapped. */
export function SpeedDialFab({ actions }: { actions: SpeedDialAction[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/45"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>

      <div className="fixed right-5 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {open
            ? actions.map((action, index) => (
                <motion.button
                  key={action.label}
                  type="button"
                  initial={{ opacity: 0, y: 14, scale: 0.85 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: 'spring', stiffness: 420, damping: 26, delay: (actions.length - 1 - index) * 0.05 },
                  }}
                  exit={{ opacity: 0, y: 14, scale: 0.85, transition: { duration: 0.1 } }}
                  onClick={() => {
                    setOpen(false)
                    action.onClick()
                  }}
                  className="flex items-center gap-3"
                >
                  <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-md">
                    {action.label}
                  </span>
                  <span className={cn('flex size-12 items-center justify-center rounded-full shadow-lg', action.tone)}>
                    <action.icon className="size-5" />
                  </span>
                </motion.button>
              ))
            : null}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? 'Close' : 'Add transaction'}
          aria-expanded={open}
          className="flex size-14 items-center justify-center rounded-full bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/35 ring-1 ring-white/20 transition-transform duration-200 hover:scale-105 active:scale-90"
        >
          <motion.span animate={{ rotate: open ? 135 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
            <Plus className="size-6" />
          </motion.span>
        </button>
      </div>
    </>
  )
}
