import { supabase } from '@/lib/supabase'
import type { ExpenseRow, FloorRow, HouseRow, IncomeRow, LoanRepaymentRow, LoanRow, PaymentRow, TenantRow } from '@/types/database.types'
import { SHEET_COLUMN_WIDTHS, backupToSheets, type Backup } from '../excel-format'

const PAGE_SIZE = 1000

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Builds the Excel file (Residency, Loans and Expenses sheets). */
export async function backupToXlsx(backup: Backup): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const sheets = backupToSheets(backup).map((s) => ({ ...s, columns: SHEET_COLUMN_WIDTHS }))
  const blob = await writeXlsxFile(sheets as never).toBlob()
  return blob.type === XLSX_TYPE ? blob : new Blob([blob], { type: XLSX_TYPE })
}

async function getBuildingId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.from('building').select('id').eq('owner_id', user.id).single()
  if (error) throw error
  return data.id
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Reads every row, past Supabase's per-request row cap. */
async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return all
  }
}

/** Everything the owner entered, read from the database. */
export async function exportBackup(): Promise<Backup> {
  const buildingId = await getBuildingId()

  const floors = await fetchAll<FloorRow>((a, b) =>
    supabase.from('floors').select('*').eq('building_id', buildingId).order('floor_number').range(a, b),
  )
  const floorIds = floors.map((f) => f.id)
  const houses = floorIds.length
    ? await fetchAll<HouseRow>((a, b) => supabase.from('houses').select('*').in('floor_id', floorIds).order('id').range(a, b))
    : []
  const tenants = await fetchAll<TenantRow>((a, b) =>
    supabase.from('tenants').select('*').eq('building_id', buildingId).order('id').range(a, b),
  )
  const tenantIds = tenants.map((t) => t.id)
  const payments = tenantIds.length
    ? await fetchAll<PaymentRow>((a, b) => supabase.from('payments').select('*').in('tenant_id', tenantIds).order('id').range(a, b))
    : []
  const loans = await fetchAll<LoanRow>((a, b) =>
    supabase.from('loans').select('*').eq('building_id', buildingId).order('id').range(a, b),
  )
  const loanIds = loans.map((l) => l.id)
  const loanRepayments = loanIds.length
    ? await fetchAll<LoanRepaymentRow>((a, b) =>
        supabase.from('loan_repayments').select('*').in('loan_id', loanIds).order('id').range(a, b),
      )
    : []
  const expenses = await fetchAll<ExpenseRow>((a, b) =>
    supabase.from('expenses').select('*').eq('building_id', buildingId).order('id').range(a, b),
  )
  const incomes = await fetchAll<IncomeRow>((a, b) =>
    supabase.from('incomes').select('*').eq('building_id', buildingId).order('id').range(a, b),
  )

  return {
    floors,
    houses,
    tenants,
    payments,
    loans,
    loanRepayments,
    expenses,
    incomes,
  }
}
