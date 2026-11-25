import { dateOnlyIso } from '@/utils/format'
import type { Expense } from '@/features/expenses/types'
import type { Income } from '@/features/income/types'
import type { RentIncomeEntry } from '@/features/tenants/services/tenants.service'

/** One row of the combined money ledger. Rent collected from tenants counts
 * as income but is managed from the tenant, so it's read-only here. */
export type Transaction =
  | { kind: 'expense'; id: string; amount: number; date: string; createdAt: string; expense: Expense }
  | { kind: 'income'; id: string; amount: number; date: string; createdAt: string; income: Income }
  | { kind: 'rent'; id: string; amount: number; date: string; createdAt: string; rent: RentIncomeEntry }

export type PeriodFilter = 'all' | 'this_week' | 'this_month' | 'last_month' | 'last_30' | 'last_3_months' | 'this_year'
export type TypeFilter = 'all' | 'income' | 'expense'

export interface TransactionFilters {
  period: PeriodFilter
  type: TypeFilter
}

export const defaultFilters: TransactionFilters = { period: 'all', type: 'all' }

export const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'this_year', label: 'This year' },
]

export const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

export function isIncome(transaction: Transaction): boolean {
  return transaction.kind !== 'expense'
}

export function isFiltered(filters: TransactionFilters): boolean {
  return filters.period !== defaultFilters.period || filters.type !== defaultFilters.type
}

/** Inclusive `YYYY-MM-DD` bounds for a period (null = unbounded). */
export function periodRange(period: PeriodFilter, now: Date = new Date()): { from: string | null; to: string | null } {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  switch (period) {
    case 'this_week': {
      // Weeks start on Monday.
      const sinceMonday = (now.getDay() + 6) % 7
      return { from: dateOnlyIso(new Date(y, m, d - sinceMonday)), to: null }
    }
    case 'last_30':
      return { from: dateOnlyIso(new Date(y, m, d - 29)), to: null }
    case 'this_month':
      return { from: dateOnlyIso(new Date(y, m, 1)), to: null }
    case 'last_month':
      return { from: dateOnlyIso(new Date(y, m - 1, 1)), to: dateOnlyIso(new Date(y, m, 0)) }
    case 'last_3_months':
      return { from: dateOnlyIso(new Date(y, m - 2, 1)), to: null }
    case 'this_year':
      return { from: dateOnlyIso(new Date(y, 0, 1)), to: null }
    default:
      return { from: null, to: null }
  }
}
