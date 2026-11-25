import { Pencil, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/utils/format'
import { incomeCategoryLabel, type Income } from '../types'

interface IncomeDetailSheetProps {
  income: Income | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

export function IncomeDetailSheet({ income, open, onOpenChange, onEdit, onDelete }: IncomeDetailSheetProps) {
  if (!income) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="pb-2">
          <SheetTitle>{incomeCategoryLabel(income.category)}</SheetTitle>
          <p className="text-xs text-muted-foreground">{formatDate(income.incomeDate)}</p>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="font-numeric text-2xl font-semibold text-foreground">{formatCurrency(income.amount)}</p>
          </div>

          {income.description ? (
            <div>
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-sm font-medium text-foreground">{income.description}</p>
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
