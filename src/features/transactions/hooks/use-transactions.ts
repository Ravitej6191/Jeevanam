import { useMemo } from 'react'
import { useExpenses } from '@/features/expenses/hooks/use-expenses'
import { useIncomes } from '@/features/income/hooks/use-incomes'
import { useRentIncome } from '@/features/tenants/hooks/use-rent-income'
import type { Transaction } from '../types'

/** Expenses, other income and rent collected, merged newest-first. */
export function useTransactions() {
  const expenses = useExpenses()
  const incomes = useIncomes()
  const rent = useRentIncome()

  const transactions = useMemo<Transaction[]>(() => {
    const all: Transaction[] = [
      ...(expenses.data ?? []).map((expense): Transaction => ({
        kind: 'expense',
        id: expense.id,
        amount: expense.amount,
        date: expense.expenseDate,
        createdAt: expense.createdAt,
        expense,
      })),
      ...(incomes.data ?? []).map((income): Transaction => ({
        kind: 'income',
        id: income.id,
        amount: income.amount,
        date: income.incomeDate,
        createdAt: income.createdAt,
        income,
      })),
      ...(rent.data ?? []).map((entry): Transaction => ({
        kind: 'rent',
        id: entry.id,
        amount: entry.amount,
        date: entry.paymentDate,
        createdAt: entry.createdAt,
        rent: entry,
      })),
    ]
    return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [expenses.data, incomes.data, rent.data])

  return {
    transactions,
    isLoading: expenses.isLoading || incomes.isLoading || rent.isLoading,
    isError: expenses.isError || incomes.isError || rent.isError,
    refetch: () => Promise.all([expenses.refetch(), incomes.refetch(), rent.refetch()]),
  }
}
