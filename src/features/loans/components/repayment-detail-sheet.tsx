import { Pencil, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import type { LoanRepayment } from '../types'

interface RepaymentDetailSheetProps {
  repayment: LoanRepayment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

export function RepaymentDetailSheet({ repayment, open, onOpenChange, onEdit, onDelete }: RepaymentDetailSheetProps) {
  if (!repayment) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="pb-2">
          <SheetTitle>Repayment</SheetTitle>
          <p className="text-xs text-muted-foreground">Recorded {formatDateTime(repayment.createdAt)}</p>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="font-numeric text-2xl font-semibold text-foreground">{formatCurrency(repayment.amount)}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Paid on</p>
            <p className="text-sm font-medium text-foreground">{formatDate(repayment.paymentDate)}</p>
          </div>

          {repayment.notes ? (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm font-medium text-foreground">{repayment.notes}</p>
            </div>
          ) : null}

          {repayment.imageUrls.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Photos ({repayment.imageUrls.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {repayment.imageUrls.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt={`Receipt ${i + 1}`}
                      className="aspect-square w-full rounded-lg border border-border object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onEdit}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button variant="outline" className="flex-1 text-danger hover:text-danger" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
