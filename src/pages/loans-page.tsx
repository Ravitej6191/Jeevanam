import { useMemo, useState } from 'react'
import { HandCoins, Plus } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Fab } from '@/components/common/fab'
import { PullToRefresh } from '@/components/common/pull-to-refresh'
import { Skeleton } from '@/components/ui/skeleton'
import { useLoans } from '@/features/loans/hooks/use-loans'
import { LoanListItem } from '@/features/loans/components/loan-list-item'
import { AddLoanSheet } from '@/features/loans/components/add-loan-sheet'
import { formatCurrency } from '@/utils/format'
import { usePageTitle } from '@/hooks/use-page-title'

export function LoansPage() {
  usePageTitle('Loans')
  const { data: loans, isLoading, isError, refetch } = useLoans()
  const [addOpen, setAddOpen] = useState(false)

  const totals = useMemo(() => {
    const all = loans ?? []
    return {
      lent: all.reduce((sum, l) => sum + l.amount, 0),
      paid: all.reduce((sum, l) => sum + l.paidTillNow, 0),
      balance: all.reduce((sum, l) => sum + l.stillToPay, 0),
    }
  }, [loans])

  return (
    <>
      <PullToRefresh onRefresh={refetch}>
        <div className="space-y-3">
          {!isError && loans && loans.length > 0 ? (
            <div className="grid grid-cols-3 gap-2.5">
              <SummaryCard label="Total Lent" value={formatCurrency(totals.lent)} tone="text-foreground" />
              <SummaryCard label="Paid Till Now" value={formatCurrency(totals.paid)} tone="text-success" />
              <SummaryCard label="Balance" value={formatCurrency(totals.balance)} tone="text-danger" />
            </div>
          ) : null}
          {isError ? (
            <ErrorState title="Couldn't load loans" description="Please try again." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : !loans || loans.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No loans yet"
              description="Add a loan to start tracking what's borrowed and repaid."
              className="mt-4"
            />
          ) : (
            loans.map((loan) => <LoanListItem key={loan.id} loan={loan} />)
          )}
        </div>
      </PullToRefresh>

      <Fab onClick={() => setAddOpen(true)}>
        <Plus className="size-6" />
      </Fab>

      <AddLoanSheet open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`font-numeric mt-1 truncate text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}
