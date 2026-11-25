import { useMemo } from 'react'
import { BreakdownPie, type BreakdownSlice } from '@/components/common/breakdown-pie'
import { formatCurrency } from '@/utils/format'
import type { DashboardData } from '../types'

function SummaryStat({ label, value, dotClassName }: { label: string; value: number; dotClassName: string }) {
  return (
    <div className="flex-1 space-y-1">
      <div className="flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${dotClassName}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="font-numeric text-lg leading-none font-semibold text-foreground">{formatCurrency(value)}</p>
    </div>
  )
}

/** One simple pie: income vs expense for the chosen period. */
export function MoneyBreakdown({ data }: { data: DashboardData }) {
  const totalIncome = data.trend.reduce((sum, d) => sum + d.income, 0)
  const totalExpenses = data.trend.reduce((sum, d) => sum + d.expenses, 0)

  const slices = useMemo<BreakdownSlice[]>(
    () => [
      { label: 'Income', value: totalIncome, color: '#22c55e' },
      { label: 'Expense', value: totalExpenses, color: '#f59e0b' },
    ],
    [totalIncome, totalExpenses],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-lg bg-muted/40 px-3.5 py-3">
        <SummaryStat label="Income" value={totalIncome} dotClassName="bg-success" />
        <div className="h-8 w-px bg-border" />
        <SummaryStat label="Expense" value={totalExpenses} dotClassName="bg-warning" />
      </div>

      <BreakdownPie slices={slices} centerLabel="Balance" centerValue={totalIncome - totalExpenses} />
    </div>
  )
}
