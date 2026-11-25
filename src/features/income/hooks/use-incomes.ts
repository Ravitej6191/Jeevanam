import { useQuery } from '@tanstack/react-query'
import { getIncomes } from '../services/income.service'

export function useIncomes() {
  return useQuery({
    queryKey: ['incomes', 'list'],
    queryFn: getIncomes,
  })
}
