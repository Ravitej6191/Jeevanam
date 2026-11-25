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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/common/date-picker'
import { PhotoPicker } from '@/components/common/photo-picker'
import { usePhotos } from '@/hooks/use-photos'
import { todayIso } from '@/utils/format'
import { createExpense, updateExpense } from '../services/expenses.service'
import { expenseCategoryOptions, type Expense, type ExpenseCategory } from '../types'

const categoryValues = expenseCategoryOptions.map((o) => o.value) as [ExpenseCategory, ...ExpenseCategory[]]

const expenseSchema = z
  .object({
    category: z.enum(categoryValues),
    amount: z
      .number({ error: 'Enter a valid amount' })
      .int('Enter a whole rupee amount')
      .min(1, 'Enter a valid amount')
      .max(10_000_000, 'Amount seems too high'),
    expenseDate: z.string().min(1, 'Choose a date'),
    description: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.category === 'misc' && !values.description.trim()) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'Tell us what this expense was for' })
    }
  })

type ExpenseFormValues = z.infer<typeof expenseSchema>

const emptyValues = (): ExpenseFormValues => ({ category: 'groceries', amount: 0, expenseDate: todayIso(), description: '' })

interface ExpenseFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingExpense?: Expense | null
}

export function ExpenseFormSheet({ open, onOpenChange, existingExpense }: ExpenseFormSheetProps) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(existingExpense)
  const [isUploading, setIsUploading] = useState(false)
  const { photos, add, remove, reset: resetPhotos, resolveUrls } = usePhotos('expense-receipts')

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    if (existingExpense) {
      reset({
        category: existingExpense.category,
        amount: existingExpense.amount,
        expenseDate: existingExpense.expenseDate,
        description: existingExpense.description ?? '',
      })
      resetPhotos(existingExpense.imageUrls)
    } else {
      reset(emptyValues())
      resetPhotos()
    }
  }, [open, existingExpense, reset, resetPhotos])

  const isOthers = watch('category') === 'misc'

  const mutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
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
        category: values.category,
        amount: values.amount,
        expenseDate: values.expenseDate,
        description: values.description.trim() || null,
        imageUrls,
      }
      if (existingExpense) return updateExpense({ id: existingExpense.id, ...shared })
      return createExpense(shared)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])
      toast.success(isEditing ? 'Expense updated' : 'Expense added')
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save the expense. Please try again.'),
  })

  const isPending = mutation.isPending || isUploading

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4 px-4 pb-8">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                // key={field.value} remounts Radix's Select when the value is set
                // programmatically (reset() when editing) — otherwise it fires
                // onValueChange('') to "correct" itself and wipes the value.
                <Select key={field.value} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input id="expense-amount" type="number" {...register('amount', { valueAsNumber: true })} />
              {errors.amount ? <p className="text-xs text-danger">{errors.amount.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Controller
                name="expenseDate"
                control={control}
                render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">{isOthers ? 'What was this for?' : 'Description (optional)'}</Label>
            <Input
              id="expense-description"
              placeholder={isOthers ? 'e.g. Plumber visit' : undefined}
              {...register('description')}
            />
            {errors.description ? <p className="text-xs text-danger">{errors.description.message}</p> : null}
          </div>

          <PhotoPicker photos={photos} onAdd={add} onRemove={remove} label="Receipt photos (optional)" />

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEditing ? 'Save Changes' : 'Add Expense'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
