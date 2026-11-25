import { useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/common/date-picker'
import { StatusChip } from '@/components/common/status-chip'
import { rentStatusTokens } from '@/constants/status'
import { formatCurrency, formatDateTime } from '@/utils/format'
import type { PaymentMode, RentStatus } from '@/types/database.types'

export type HistoryEntry =
  | {
      kind: 'rent'
      id: string
      amount: number
      date: string
      createdAt: string
      mode: PaymentMode
      status: RentStatus
      notes: string | null
      receiptNumber: string | null
      receiptUrl: string | null
    }
  | {
      kind: 'deposit'
      amount: number
      date: string
      recordedAt: string
      screenshotUrl: string | null
    }

export interface EditPaymentValues {
  amount: number
  paymentDate: string
}

interface PaymentDetailSheetProps {
  entry: HistoryEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (paymentId: string) => void
  onDeleteDeposit: () => void
  onEditPayment: (paymentId: string, values: EditPaymentValues) => void
  onEditDeposit: (values: EditPaymentValues) => void
  isEditPending?: boolean
}

export function PaymentDetailSheet({
  entry,
  open,
  onOpenChange,
  onDelete,
  onDeleteDeposit,
  onEditPayment,
  onEditDeposit,
  isEditPending = false,
}: PaymentDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    setIsEditing(false)
  }, [entry])

  if (!entry) return null

  const startEditing = () => {
    setAmount(String(entry.amount))
    setDate(entry.kind === 'rent' ? entry.date : entry.date)
    setIsEditing(true)
  }

  const handleSave = () => {
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !date) return
    if (entry.kind === 'rent') {
      onEditPayment(entry.id, { amount: parsedAmount, paymentDate: date })
    } else {
      onEditDeposit({ amount: parsedAmount, paymentDate: date })
    }
  }

  const amountValue = Number(amount)
  const isAmountValid = Number.isFinite(amountValue) && amountValue > 0
  const canSave = isAmountValid && Boolean(date)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Edit ' : ''}
            {entry.kind === 'deposit' ? 'Deposit' : 'Payment'} {isEditing ? '' : 'Details'}
          </SheetTitle>
        </SheetHeader>

        {isEditing ? (
          <div className="space-y-4 px-4 pb-8">
            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
              {amount && !isAmountValid ? <p className="text-xs text-danger">Enter a valid amount</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={!canSave || isEditPending} onClick={handleSave}>
                {isEditPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-8">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-numeric text-lg font-semibold text-foreground">{formatCurrency(entry.amount)}</p>
              </div>
              {entry.kind === 'rent' ? <StatusChip token={rentStatusTokens[entry.status]} /> : null}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Recorded</p>
                <p className="font-medium text-foreground">
                  {formatDateTime(entry.kind === 'rent' ? entry.createdAt : entry.recordedAt)}
                </p>
              </div>
              {entry.kind === 'rent' ? (
                <div>
                  <p className="text-xs text-muted-foreground">Mode</p>
                  <p className="font-medium text-foreground capitalize">{entry.mode.replace('_', ' ')}</p>
                </div>
              ) : null}
              {entry.kind === 'rent' && entry.receiptNumber ? (
                <div>
                  <p className="text-xs text-muted-foreground">Receipt</p>
                  <p className="font-medium text-foreground">{entry.receiptNumber}</p>
                </div>
              ) : null}
            </div>

            {entry.kind === 'rent' && entry.notes ? (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm text-foreground">{entry.notes}</p>
              </div>
            ) : null}

            {entry.kind === 'deposit' && entry.screenshotUrl ? (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Attached photo</p>
                <img
                  src={entry.screenshotUrl}
                  alt="Deposit proof"
                  className="max-h-72 w-full rounded-lg border border-border/70 object-cover"
                />
              </div>
            ) : null}

            {entry.kind === 'rent' && entry.receiptUrl ? (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Attached photo</p>
                <img
                  src={entry.receiptUrl}
                  alt="Payment photo"
                  className="max-h-72 w-full rounded-lg border border-border/70 object-cover"
                />
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={startEditing}>
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-danger hover:text-danger"
                onClick={entry.kind === 'rent' ? () => onDelete(entry.id) : onDeleteDeposit}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
