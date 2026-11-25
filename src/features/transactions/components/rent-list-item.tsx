import { ChevronRight, Home } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import { FlowArrow } from './flow-arrow'
import type { RentIncomeEntry } from '@/features/tenants/services/tenants.service'

/** Rent collected from a tenant. Read-only here — opens the tenant. */
export function RentListItem({ entry, onSelect }: { entry: RentIncomeEntry; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="press-scale group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all duration-200 ease-[var(--ease-out-smooth)] hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success transition-transform duration-200 group-hover:scale-110">
        <Home className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">Rent · {entry.tenantName}</p>
        <p className="truncate text-xs text-muted-foreground">{formatDate(entry.paymentDate)}</p>
      </div>
      <FlowArrow direction="in" />
      <p className="font-numeric text-sm font-semibold text-success">+{formatCurrency(entry.amount)}</p>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
