import type { IncomeCategory } from '@/types/database.types'

export type { IncomeCategory }

export interface Income {
  id: string
  category: IncomeCategory
  amount: number
  incomeDate: string
  description: string | null
  createdAt: string
}

export const incomeCategoryOptions: { value: IncomeCategory; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'business', label: 'Business' },
  { value: 'interest', label: 'Interest' },
  { value: 'gift', label: 'Gift' },
  { value: 'refund', label: 'Refund' },
  { value: 'misc', label: 'Others' },
]

export function incomeCategoryLabel(category: IncomeCategory): string {
  return incomeCategoryOptions.find((o) => o.value === category)?.label ?? category
}
