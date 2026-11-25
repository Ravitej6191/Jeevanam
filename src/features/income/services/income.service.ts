import { isDemoSession } from '@/config/env'
import { supabase } from '@/lib/supabase'
import {
  addIncome as demoAddIncome,
  deleteIncome as demoDeleteIncome,
  getDemoDb,
  updateIncome as demoUpdateIncome,
  type AddIncomeInput,
  type UpdateIncomeInput,
} from '@/lib/demo-store'
import { pushSupabaseNotification } from '@/features/notifications/services/notifications.service'
import { formatCurrency } from '@/utils/format'
import type { Income } from '../types'

async function getBuildingId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.from('building').select('id').eq('owner_id', user.id).single()
  if (error) throw error
  return data.id
}

export async function getIncomes(): Promise<Income[]> {
  if (isDemoSession()) {
    return getDemoDb()
      .incomes.map((i) => ({ ...i }))
      .sort((a, b) => b.incomeDate.localeCompare(a.incomeDate))
  }

  const buildingId = await getBuildingId()
  const { data, error } = await supabase
    .from('incomes')
    .select('id, category, amount, income_date, description, created_at')
    .eq('building_id', buildingId)
    .order('income_date', { ascending: false })
  if (error) throw error

  return data.map((i) => ({
    id: i.id,
    category: i.category,
    amount: i.amount,
    incomeDate: i.income_date,
    description: i.description,
    createdAt: i.created_at,
  }))
}

export type CreateIncomeInput = AddIncomeInput

export async function createIncome(input: CreateIncomeInput): Promise<void> {
  if (isDemoSession()) {
    demoAddIncome(input)
    return
  }

  const buildingId = await getBuildingId()
  const { error } = await supabase.from('incomes').insert({
    building_id: buildingId,
    category: input.category,
    amount: input.amount,
    income_date: input.incomeDate,
    description: input.description,
  })
  if (error) throw error

  await pushSupabaseNotification(buildingId, 'payment', 'Income added', `${formatCurrency(input.amount)} income recorded.`)
}

export type EditIncomeInput = UpdateIncomeInput

export async function updateIncome(input: EditIncomeInput): Promise<void> {
  if (isDemoSession()) {
    demoUpdateIncome(input)
    return
  }

  const { error } = await supabase
    .from('incomes')
    .update({
      category: input.category,
      amount: input.amount,
      income_date: input.incomeDate,
      description: input.description,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function deleteIncome(incomeId: string): Promise<void> {
  if (isDemoSession()) {
    demoDeleteIncome(incomeId)
    return
  }

  const { error } = await supabase.from('incomes').delete().eq('id', incomeId)
  if (error) throw error
}
