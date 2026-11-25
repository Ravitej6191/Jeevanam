import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

/** Green arrow for money coming in, red arrow for money going out. */
export function FlowArrow({ direction }: { direction: 'in' | 'out' }) {
  const isIn = direction === 'in'
  const Icon = isIn ? ArrowDownLeft : ArrowUpRight
  return (
    <span
      role="img"
      aria-label={isIn ? 'Money in' : 'Money out'}
      className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
        isIn ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
      }`}
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
    </span>
  )
}
