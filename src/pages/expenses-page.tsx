import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Search, SlidersHorizontal, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmSheet } from '@/components/common/confirm-sheet'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { PullToRefresh } from '@/components/common/pull-to-refresh'
import { SpeedDialFab } from '@/components/common/speed-dial-fab'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ExpenseDetailSheet } from '@/features/expenses/components/expense-detail-sheet'
import { ExpenseFormSheet } from '@/features/expenses/components/expense-form-sheet'
import { ExpenseListItem } from '@/features/expenses/components/expense-list-item'
import { deleteExpense } from '@/features/expenses/services/expenses.service'
import { expenseCategoryOptions, type Expense } from '@/features/expenses/types'
import { IncomeDetailSheet } from '@/features/income/components/income-detail-sheet'
import { IncomeFormSheet } from '@/features/income/components/income-form-sheet'
import { IncomeListItem } from '@/features/income/components/income-list-item'
import { deleteIncome } from '@/features/income/services/income.service'
import { incomeCategoryLabel, type Income } from '@/features/income/types'
import { RentListItem } from '@/features/transactions/components/rent-list-item'
import { TransactionFilterSheet } from '@/features/transactions/components/transaction-filter-sheet'
import { useTransactions } from '@/features/transactions/hooks/use-transactions'
import {
  defaultFilters,
  isFiltered,
  isIncome,
  periodRange,
  type Transaction,
  type TransactionFilters,
} from '@/features/transactions/types'
import { formatCurrency } from '@/utils/format'
import { usePageTitle } from '@/hooks/use-page-title'
import { cn } from '@/lib/utils'

const expenseLabel = (category: string) => expenseCategoryOptions.find((o) => o.value === category)?.label ?? category

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year!, (month ?? 1) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function searchText(transaction: Transaction): string {
  switch (transaction.kind) {
    case 'expense':
      return `${expenseLabel(transaction.expense.category)} ${transaction.expense.description ?? ''} expense`
    case 'income':
      return `${incomeCategoryLabel(transaction.income.category)} ${transaction.income.description ?? ''} income`
    case 'rent':
      return `rent ${transaction.rent.tenantName} income`
  }
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string
  value: number
  tone: string
  icon?: typeof ArrowUpRight
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {Icon ? <Icon className={cn('size-3', tone)} /> : null}
        {label}
      </div>
      <p className={cn('font-numeric mt-1 truncate text-sm font-semibold', tone)}>{formatCurrency(value)}</p>
    </div>
  )
}

export function ExpensesPage() {
  const navigate = useNavigate()
  usePageTitle('Expenses')
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { transactions, isLoading, isError, refetch } = useTransactions()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters)
  const [filterOpen, setFilterOpen] = useState(false)

  const [expenseSheet, setExpenseSheet] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null })
  const [incomeSheet, setIncomeSheet] = useState<{ open: boolean; income: Income | null }>({ open: false, income: null })
  const [viewing, setViewing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)

  // Deep links from elsewhere (e.g. the dashboard's "Add Expense" shortcut).
  useEffect(() => {
    const add = searchParams.get('add')
    if (!add) return
    if (add === 'expense') setExpenseSheet({ open: true, expense: null })
    if (add === 'income') setIncomeSheet({ open: true, income: null })
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const { from, to } = periodRange(filters.period)
    return transactions.filter((t) => {
      if (filters.type === 'income' && !isIncome(t)) return false
      if (filters.type === 'expense' && isIncome(t)) return false
      if (from && t.date < from) return false
      if (to && t.date > to) return false
      return !query || searchText(t).toLowerCase().includes(query)
    })
  }, [transactions, search, filters])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of filtered) {
      if (isIncome(t)) income += t.amount
      else expense += t.amount
    }
    return { income, expense, balance: income - expense }
  }, [filtered])

  const groups = useMemo(() => {
    const byMonth = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const key = t.date.slice(0, 7)
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key)!.push(t)
    }
    return Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => ({
        key,
        label: monthLabel(key),
        net: items.reduce((sum, t) => sum + (isIncome(t) ? t.amount : -t.amount), 0),
        items,
      }))
  }, [filtered])

  const deleteMutation = useMutation({
    mutationFn: (transaction: Transaction) => {
      if (transaction.kind === 'expense') return deleteExpense(transaction.id)
      if (transaction.kind === 'income') return deleteIncome(transaction.id)
      return Promise.resolve()
    },
    onSuccess: async (_, transaction) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [transaction.kind === 'expense' ? 'expenses' : 'incomes'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      toast.success(transaction.kind === 'expense' ? 'Expense deleted' : 'Income deleted')
      setDeleting(null)
    },
    onError: () => toast.error('Could not delete this entry. Please try again.'),
  })

  const filtersActive = isFiltered(filters)
  const hasAny = transactions.length > 0

  const openTransaction = (transaction: Transaction) => {
    if (transaction.kind === 'rent') navigate(`/tenants/${transaction.rent.tenantId}`)
    else setViewing(transaction)
  }

  return (
    <>
      <PullToRefresh onRefresh={refetch}>
        <div className="space-y-4 pb-20">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label="Filters"
              className={cn(
                'relative flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors',
                filtersActive ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:text-foreground',
              )}
            >
              <SlidersHorizontal className="size-4" />
              {filtersActive ? <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-background" /> : null}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <SummaryCard label="Income" value={totals.income} tone="text-success" icon={ArrowDownLeft} />
            <SummaryCard label="Expense" value={totals.expense} tone="text-danger" icon={ArrowUpRight} />
            <SummaryCard label="Balance" value={totals.balance} tone={totals.balance < 0 ? 'text-danger' : 'text-foreground'} />
          </div>

          {isError ? (
            <ErrorState title="Couldn't load transactions" description="Please try again." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : !hasAny ? (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Tap + to add an expense or income. Rent you collect shows up here automatically."
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Search} title="No matches" description="Try a different search or clear the filters." />
          ) : (
            <>
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</p>
                      <p className={cn('text-xs font-medium', group.net < 0 ? 'text-danger' : 'text-success')}>
                        {group.net < 0 ? '-' : '+'}
                        {formatCurrency(Math.abs(group.net))}
                      </p>
                    </div>
                    {group.items.map((t) =>
                      t.kind === 'expense' ? (
                        <ExpenseListItem key={`e-${t.id}`} expense={t.expense} onSelect={() => openTransaction(t)} />
                      ) : t.kind === 'income' ? (
                        <IncomeListItem key={`i-${t.id}`} income={t.income} onSelect={() => openTransaction(t)} />
                      ) : (
                        <RentListItem key={`r-${t.id}`} entry={t.rent} onSelect={() => openTransaction(t)} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </PullToRefresh>

      <SpeedDialFab
        actions={[
          {
            label: 'Expense',
            icon: ArrowUpRight,
            tone: 'bg-danger text-danger-foreground',
            onClick: () => setExpenseSheet({ open: true, expense: null }),
          },
          {
            label: 'Income',
            icon: ArrowDownLeft,
            tone: 'bg-success text-success-foreground',
            onClick: () => setIncomeSheet({ open: true, income: null }),
          },
        ]}
      />

      <TransactionFilterSheet open={filterOpen} onOpenChange={setFilterOpen} filters={filters} onChange={setFilters} />

      <ExpenseFormSheet
        open={expenseSheet.open}
        onOpenChange={(open) => !open && setExpenseSheet((s) => ({ ...s, open: false }))}
        existingExpense={expenseSheet.expense}
      />
      <IncomeFormSheet
        open={incomeSheet.open}
        onOpenChange={(open) => !open && setIncomeSheet((s) => ({ ...s, open: false }))}
        existingIncome={incomeSheet.income}
      />

      <ExpenseDetailSheet
        expense={viewing?.kind === 'expense' ? viewing.expense : null}
        open={viewing?.kind === 'expense'}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={() => {
          if (viewing?.kind === 'expense') setExpenseSheet({ open: true, expense: viewing.expense })
          setViewing(null)
        }}
        onDelete={() => {
          setDeleting(viewing)
          setViewing(null)
        }}
      />
      <IncomeDetailSheet
        income={viewing?.kind === 'income' ? viewing.income : null}
        open={viewing?.kind === 'income'}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={() => {
          if (viewing?.kind === 'income') setIncomeSheet({ open: true, income: viewing.income })
          setViewing(null)
        }}
        onDelete={() => {
          setDeleting(viewing)
          setViewing(null)
        }}
      />

      <ConfirmSheet
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting?.kind === 'income' ? 'Delete this income?' : 'Delete this expense?'}
        description="This can't be undone."
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting)
        }}
      />
    </>
  )
}
