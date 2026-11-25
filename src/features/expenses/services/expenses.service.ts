import { supabase } from '@/lib/supabase'
import type { ExpenseCategory } from '@/types/database.types'
import { pushSupabaseNotification } from '@/features/notifications/services/notifications.service'
import { formatCurrency } from '@/utils/format'
import type { Expense } from '../types'

export async function getExpenses(): Promise<Expense[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (buildingError) throw buildingError

  const { data, error } = await supabase
    .from('expenses')
    .select('id, category, amount, expense_date, description, invoice_urls, created_at')
    .eq('building_id', buildingRow.id)
    .order('expense_date', { ascending: false })
  if (error) throw error

  return data.map((e) => ({
    id: e.id,
    category: e.category,
    amount: e.amount,
    expenseDate: e.expense_date,
    description: e.description,
    imageUrls: e.invoice_urls,
    createdAt: e.created_at,
  }))
}

export interface CreateExpenseInput {
  category: ExpenseCategory
  amount: number
  expenseDate: string
  description: string | null
  imageUrls: string[]
}

export async function createExpense(input: CreateExpenseInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (buildingError) throw buildingError

  const { error } = await supabase.from('expenses').insert({
    building_id: buildingRow.id,
    category: input.category,
    amount: input.amount,
    expense_date: input.expenseDate,
    description: input.description,
    invoice_urls: input.imageUrls,
  })
  if (error) throw error

  await pushSupabaseNotification(
    buildingRow.id,
    'expense',
    'Expense added',
    `${formatCurrency(input.amount)} expense recorded.`,
  )
}

export interface EditExpenseInput extends CreateExpenseInput {
  id: string
}

export async function updateExpense(input: EditExpenseInput): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      category: input.category,
      amount: input.amount,
      expense_date: input.expenseDate,
      description: input.description,
      invoice_urls: input.imageUrls,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) throw error
}
