import { useQuery } from '@tanstack/react-query'
import { getRentIncomeEntries } from '../services/tenants.service'

/** Every rent payment received — keyed under `tenants` so recording or
 * deleting a payment (which already invalidates `tenants`) refreshes it. */
export function useRentIncome() {
  return useQuery({
    queryKey: ['tenants', 'rent-income'],
    queryFn: getRentIncomeEntries,
  })
}
