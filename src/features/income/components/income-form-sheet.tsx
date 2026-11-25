import { useEffect } from 'react'
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
import { todayIso } from '@/utils/format'
import { createIncome, updateIncome } from '../services/income.service'
import { incomeCategoryOptions, type Income, type IncomeCategory } from '../types'

const categoryValues = incomeCategoryOptions.map((o) => o.value) as [IncomeCategory, ...IncomeCategory[]]

const incomeSchema = z
  .object({
    category: z.enum(categoryValues),
    amount: z
      .number({ error: 'Enter a valid amount' })
      .int('Enter a whole rupee amount')
      .min(1, 'Enter a valid amount')
      .max(10_000_000, 'Amount seems too high'),
    incomeDate: z.string().min(1, 'Choose a date'),
    description: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.category === 'misc' && !values.description.trim()) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'Tell us where this income came from' })
    }
  })

type IncomeFormValues = z.infer<typeof incomeSchema>

const emptyValues = (): IncomeFormValues => ({ category: 'salary', amount: 0, incomeDate: todayIso(), description: '' })

interface IncomeFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingIncome?: Income | null
}

export function IncomeFormSheet({ open, onOpenChange, existingIncome }: IncomeFormSheetProps) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(existingIncome)

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    if (existingIncome) {
      reset({
        category: existingIncome.category,
        amount: existingIncome.amount,
        incomeDate: existingIncome.incomeDate,
        description: existingIncome.description ?? '',
      })
    } else {
      reset(emptyValues())
    }
  }, [open, existingIncome, reset])

  const isOthers = watch('category') === 'misc'

  const mutation = useMutation({
    mutationFn: (values: IncomeFormValues) => {
      const shared = {
        category: values.category,
        amount: values.amount,
        incomeDate: values.incomeDate,
        description: values.description.trim() || null,
      }
      return existingIncome ? updateIncome({ id: existingIncome.id, ...shared }) : createIncome(shared)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['incomes'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])
      toast.success(isEditing ? 'Income updated' : 'Income added')
      onOpenChange(false)
    },
    onError: () => toast.error('Could not save the income. Please try again.'),
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Income' : 'Add Income'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4 px-4 pb-8">
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select key={field.value} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeCategoryOptions.map((option) => (
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
              <Label htmlFor="income-amount">Amount</Label>
              <Input id="income-amount" type="number" {...register('amount', { valueAsNumber: true })} />
              {errors.amount ? <p className="text-xs text-danger">{errors.amount.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Controller
                name="incomeDate"
                control={control}
                render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="income-description">{isOthers ? 'Where did this come from?' : 'Description (optional)'}</Label>
            <Input
              id="income-description"
              placeholder={isOthers ? 'e.g. Sold old furniture' : undefined}
              {...register('description')}
            />
            {errors.description ? <p className="text-xs text-danger">{errors.description.message}</p> : null}
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEditing ? 'Save Changes' : 'Add Income'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
