import { useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { ArrowDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const THRESHOLD = 64
const MAX_PULL = 96
const PULL_RESISTANCE = 0.5

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | unknown
  children: ReactNode
  className?: string
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const y = useMotionValue(0)
  const [refreshing, setRefreshing] = useState(false)
  const rotate = useTransform(y, [0, THRESHOLD], [0, 180])
  const opacity = useTransform(y, [0, THRESHOLD / 2], [0, 1])

  const startY = useRef<number | null>(null)
  const pulling = useRef(false)

  const settle = (target: number) => animate(y, target, { type: 'spring', stiffness: 300, damping: 30 })

  const handleTouchStart = (e: ReactTouchEvent) => {
    if (refreshing || window.scrollY > 0 || e.touches.length === 0) {
      startY.current = null
      return
    }
    startY.current = e.touches[0]!.clientY
    pulling.current = false
  }

  const handleTouchMove = (e: ReactTouchEvent) => {
    if (refreshing || startY.current === null || e.touches.length === 0) return
    const delta = e.touches[0]!.clientY - startY.current
    // Not an at-top pull-down gesture — leave it to native scrolling.
    if (delta <= 0 || window.scrollY > 0) {
      startY.current = null
      return
    }
    pulling.current = true
    e.preventDefault()
    y.set(Math.min(delta * PULL_RESISTANCE, MAX_PULL))
  }

  const handleTouchEnd = () => {
    startY.current = null
    if (!pulling.current) return
    pulling.current = false

    if (y.get() >= THRESHOLD) {
      setRefreshing(true)
      settle(40)
      void Promise.resolve(onRefresh()).finally(() => {
        setRefreshing(false)
        settle(0)
      })
    } else {
      settle(0)
    }
  }

  return (
    <div
      className={cn('relative', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <motion.div
        style={{ opacity }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-1"
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-card/90 text-muted-foreground shadow-sm">
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <motion.span style={{ rotate }} className="flex">
              <ArrowDown className="size-4" />
            </motion.span>
          )}
        </span>
      </motion.div>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  )
}
