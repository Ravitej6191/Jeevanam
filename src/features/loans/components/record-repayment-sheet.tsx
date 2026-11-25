import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/common/date-picker'
import { PhotoPicker } from '@/components/common/photo-picker'
import { usePhotos } from '@/hooks/use-photos'
import { createLoanRepayment, updateLoanRepayment } from '../services/loans.service'
import { todayIso } from '@/utils/format'
import type { Loan, LoanRepayment } from '../types'

const repaymentSchema = z.object({
  amount: z.number().positive('Enter a valid amount').max(100_000_000, 'Amount seems too high'),
  paymentDate: z.string().min(1, 'Choose a date'),
  notes: z.string(),
})

type RepaymentFormValues = z.infer<typeof repaymentSchema>

interface RecordRepaymentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: Loan | null
  /** When set, the sheet edits this repayment instead of recording a new one. */
  existingRepayment?: LoanRepayment | null
}

export function RecordRepaymentSheet({ open, onOpenChange, loan, existingRepayment }: RecordRepaymentSheetProps) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(existingRepayment)
  const [isUploading, setIsUploading] = useState(false)
  const { photos, add, remove, reset: resetPhotos, resolveUrls } = usePhotos('loan-repayments')

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RepaymentFormValues>({
    resolver: zodResolver(repaymentSchema),
    defaultValues: { amount: 0, paymentDate: todayIso(), notes: '' },
  })

  useEffect(() => {
    if (!open) return
    if (existingRepayment) {
      reset({ amount: existingRepayment.amount, paymentDate: existingRepayment.paymentDate, notes: existingRepayment.notes ?? '' })
      resetPhotos(existingRepayment.imageUrls)
    } else {
      reset({ amount: 0, paymentDate: todayIso(), notes: '' })
      resetPhotos()
    }
  }, [open, existingRepayment, reset, resetPhotos])

  const mutation = useMutation({
    mutationFn: async (values: RepaymentFormValues) => {
      let imageUrls: string[]
      setIsUploading(true)
      try {
        imageUrls = await resolveUrls()
      } catch {
        throw new Error('Could not upload the photos. Please try again.')
      } finally {
        setIsUploading(false)
      }
      const shared = {
        amount: values.amount,
        paymentDate: values.paymentDate,
        notes: values.notes.trim() || null,
        imageUrls,
      }
      if (existingRepayment) return updateLoanRepayment({ id: existingRepayment.id, ...shared })
      return createLoanRepayment({ loanId: loan!.id, ...shared })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['loans'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])
      toast.success(isEditing ? 'Repayment updated' : 'Repayment recorded')
      onOpenChange(false)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not save the repayment. Please try again.'),
  })

  if (!loan) return null

  const isPending = mutation.isPending || isUploading

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Repayment' : 'Record Repayment'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4 px-4 pb-8">
          <div className="space-y-1.5">
            <Label htmlFor="repayment-amount">Amount</Label>
            <Input id="repayment-amount" type="number" {...register('amount', { valueAsNumber: true })} />
            {errors.amount ? <p className="text-xs text-danger">{errors.amount.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Controller
              name="paymentDate"
              control={control}
              render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
            />
            {errors.paymentDate ? <p className="text-xs text-danger">{errors.paymentDate.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repayment-notes">Notes (optional)</Label>
            <Input id="repayment-notes" {...register('notes')} />
          </div>

          <PhotoPicker photos={photos} onAdd={add} onRemove={remove} />

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEditing ? 'Save Changes' : 'Record Repayment'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
