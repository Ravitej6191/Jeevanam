import { supabase } from '@/lib/supabase'
import type { ExpenseRow, FloorRow, HouseRow, IncomeRow, LoanRepaymentRow, LoanRow, PaymentRow, TenantRow } from '@/types/database.types'
import {
  BackupError,
  SHEET_COLUMN_WIDTHS,
  backupToSheets,
  sheetsToBackup,
  type Backup,
  type Row,
} from '../excel-format'

export { BackupError }
export type { Backup }

const PAGE_SIZE = 1000
const INSERT_CHUNK = 500

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Reads an exported .xlsx file back into records. */
export async function readBackupFile(file: File): Promise<Backup> {
  const { default: readExcelFile } = await import('read-excel-file/browser')
  let sheets
  try {
    sheets = await readExcelFile(file)
  } catch {
    throw new BackupError('That file could not be read. Choose an .xlsx file exported from Jeevanam.')
  }
  return sheetsToBackup(sheets.map((s) => ({ sheet: s.sheet, data: s.data })))
}

/** Builds the Excel file (Residency, Loans and Expenses sheets). */
export async function backupToXlsx(backup: Backup): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const sheets = backupToSheets(backup).map((s) => ({ ...s, columns: SHEET_COLUMN_WIDTHS }))
  const blob = await writeXlsxFile(sheets as never).toBlob()
  return blob.type === XLSX_TYPE ? blob : new Blob([blob], { type: XLSX_TYPE })
}

export function summarizeBackup(backup: Backup) {
  return {
    tenants: backup.tenants.length,
    payments: backup.payments.length,
    loans: backup.loans.length,
    expenses: backup.expenses.length,
    incomes: backup.incomes.length,
  }
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

/** Everything the owner entered, as a plain object ready to be saved as JSON. */
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

async function countRows(table: 'floors' | 'tenants' | 'loans' | 'expenses' | 'incomes', buildingId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('building_id', buildingId)
  if (error) throw error
  return count ?? 0
}

async function insertChunks(table: string, items: Row[]): Promise<void> {
  for (let i = 0; i < items.length; i += INSERT_CHUNK) {
    const { error } = await supabase.from(table as 'floors').insert(items.slice(i, i + INSERT_CHUNK) as never)
    if (error) throw error
  }
}

function remap(ids: Map<string, string>, oldId: unknown): string {
  const next = typeof oldId === 'string' ? ids.get(oldId) : undefined
  if (!next) throw new BackupError('The backup is incomplete or damaged.')
  return next
}

/**
 * Loads a backup into this account, giving every record a fresh id and
 * re-linking them. Only runs on an empty account — merging into existing
 * floors/houses/tenants would collide — and undoes itself if it fails partway.
 */
export async function importBackup(backup: Backup): Promise<void> {
  const buildingId = await getBuildingId()

  const existing = await Promise.all((['floors', 'tenants', 'loans', 'expenses', 'incomes'] as const).map((t) => countRows(t, buildingId)))
  if (existing.some((n) => n > 0)) {
    throw new BackupError('Import only works on an empty account. Use Reset App Data first, then import.')
  }

  const floorIds = new Map<string, string>()
  const houseIds = new Map<string, string>()
  const tenantIds = new Map<string, string>()
  const loanIds = new Map<string, string>()
  const fresh = (map: Map<string, string>, row: Row) => {
    const id = crypto.randomUUID()
    if (typeof row.id === 'string') map.set(row.id, id)
    return id
  }

  try {
    await insertChunks(
      'floors',
      backup.floors.map((r) => ({ ...r, id: fresh(floorIds, r), building_id: buildingId })),
    )
    await insertChunks(
      'houses',
      backup.houses.map((r) => ({ ...r, id: fresh(houseIds, r), floor_id: remap(floorIds, r.floor_id) })),
    )
    await insertChunks(
      'tenants',
      backup.tenants.map((r) => ({
        ...r,
        id: fresh(tenantIds, r),
        building_id: buildingId,
        house_id: typeof r.house_id === 'string' ? (houseIds.get(r.house_id) ?? null) : null,
      })),
    )
    await insertChunks(
      'payments',
      backup.payments.map((r) => ({ ...r, id: crypto.randomUUID(), tenant_id: remap(tenantIds, r.tenant_id) })),
    )
    await insertChunks(
      'loans',
      backup.loans.map((r) => ({ ...r, id: fresh(loanIds, r), building_id: buildingId })),
    )
    await insertChunks(
      'loan_repayments',
      backup.loanRepayments.map((r) => ({ ...r, id: crypto.randomUUID(), loan_id: remap(loanIds, r.loan_id) })),
    )
    await insertChunks(
      'expenses',
      backup.expenses.map((r) => ({ ...r, id: crypto.randomUUID(), building_id: buildingId })),
    )
    await insertChunks(
      'incomes',
      backup.incomes.map((r) => ({ ...r, id: crypto.randomUUID(), building_id: buildingId })),
    )
  } catch (error) {
    // The account was empty before, so removing these rows restores that
    // state (houses, payments and repayments go with their parents). Uploaded
    // files are left alone — the backup's photo links still point at them.
    await Promise.allSettled([
      supabase.from('floors').delete().eq('building_id', buildingId),
      supabase.from('tenants').delete().eq('building_id', buildingId),
      supabase.from('loans').delete().eq('building_id', buildingId),
      supabase.from('expenses').delete().eq('building_id', buildingId),
      supabase.from('incomes').delete().eq('building_id', buildingId),
    ])
    throw error instanceof BackupError ? error : new Error('Import failed — nothing was changed.')
  }
}
