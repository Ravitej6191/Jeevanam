import { BadgeIndianRupee, Gift, HandCoins, Landmark, RotateCcw, Store, type LucideIcon } from 'lucide-react'
import { FlowArrow } from '@/features/transactions/components/flow-arrow'
import { formatCurrency, formatDate } from '@/utils/format'
import { incomeCategoryLabel, type Income, type IncomeCategory } from '../types'

const iconByCategory: Record<IncomeCategory, LucideIcon> = {
  salary: BadgeIndianRupee,
  business: Store,
  interest: Landmark,
  gift: Gift,
  refund: RotateCcw,
  misc: HandCoins,
}

export function IncomeListItem({ income, onSelect }: { income: Income; onSelect: () => void }) {
  const Icon = iconByCategory[income.category]

  return (
    <button
      type="button"
      onClick={onSelect}
      className="press-scale group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all duration-200 ease-[var(--ease-out-smooth)] hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success transition-transform duration-200 group-hover:scale-110">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{incomeCategoryLabel(income.category)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(income.incomeDate)}
          {income.description ? ` · ${income.description}` : ''}
        </p>
      </div>
      <FlowArrow direction="in" />
      <p className="font-numeric text-sm font-semibold text-success">+{formatCurrency(income.amount)}</p>
    </button>
  )
}
