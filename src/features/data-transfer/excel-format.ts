/**
 * Layout of the Excel export — pure functions, no spreadsheet library.
 *
 * Three sheets (Residency, Loans, Expenses), each holding one or more small
 * tables stacked top to bottom: a bold title row, a bold header row, the data
 * rows, then a blank row. The same layout is read back on import.
 */

export type Row = Record<string, unknown>

export interface Backup {
  floors: Row[]
  houses: Row[]
  tenants: Row[]
  payments: Row[]
  loans: Row[]
  loanRepayments: Row[]
  expenses: Row[]
  incomes: Row[]
}

export type SheetCell = string | number | null | { value: string; fontWeight: 'bold' }
export interface OutSheet {
  sheet: string
  data: SheetCell[][]
}
export interface InSheet {
  sheet: string
  data: unknown[][]
}

export class BackupError extends Error {}

type Kind = 'text' | 'number' | 'date' | 'urls'

interface Col {
  header: string
  key: string
  kind: Kind
  required?: boolean
  oneOf?: readonly string[]
}

const LENDER_TYPES = ['bank', 'society', 'dwakara', 'hand_cash', 'gold_loan', 'other'] as const
const EXPENSE_CATEGORIES = [
  'food', 'groceries', 'milk', 'vegetables', 'gas', 'electricity',
  'internet', 'cleaning', 'repairs', 'furniture', 'salary', 'misc',
] as const
const INCOME_CATEGORIES = ['salary', 'business', 'interest', 'gift', 'refund', 'misc'] as const
const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque'] as const
const RENT_STATUSES = ['paid', 'partial', 'pending', 'advance'] as const
const TENANT_STATUSES = ['active', 'vacated'] as const

const FLOORS: Col[] = [
  { header: 'Floor No', key: 'floor_number', kind: 'number', required: true },
  { header: 'Floor Name', key: 'name', kind: 'text', required: true },
]
const HOUSES: Col[] = [
  { header: 'Floor No', key: 'floor_number', kind: 'number', required: true },
  { header: 'House No', key: 'house_number', kind: 'text', required: true },
  { header: 'Gas Connection No', key: 'gas_connection_number', kind: 'text' },
  { header: 'Electricity Bill No', key: 'electricity_bill_number', kind: 'text' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const TENANTS: Col[] = [
  { header: 'Ref', key: 'ref', kind: 'number', required: true },
  { header: 'Name', key: 'name', kind: 'text', required: true },
  { header: 'Phone', key: 'phone', kind: 'text', required: true },
  { header: 'Aadhaar', key: 'aadhaar_number', kind: 'text' },
  { header: 'Occupation', key: 'occupation', kind: 'text' },
  { header: 'Address', key: 'address', kind: 'text' },
  { header: 'Floor No', key: 'floor_number', kind: 'number' },
  { header: 'House No', key: 'house_number', kind: 'text' },
  { header: 'Joined', key: 'joining_date', kind: 'date' },
  { header: 'Vacated', key: 'vacating_date', kind: 'date' },
  { header: 'Status', key: 'status', kind: 'text', oneOf: TENANT_STATUSES },
  { header: 'Rent', key: 'rent', kind: 'number' },
  { header: 'Deposit', key: 'deposit', kind: 'number' },
  { header: 'Advance', key: 'advance', kind: 'number' },
  { header: 'Deposit Paid', key: 'deposit_paid_amount', kind: 'number' },
  { header: 'Deposit Paid On', key: 'deposit_paid_date', kind: 'date' },
  { header: 'Photo', key: 'photo_url', kind: 'text' },
  { header: 'Deposit Screenshot', key: 'deposit_screenshot_url', kind: 'text' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const PAYMENTS: Col[] = [
  { header: 'Tenant Ref', key: 'tenant_ref', kind: 'number', required: true },
  { header: 'Amount', key: 'amount', kind: 'number', required: true },
  { header: 'Paid On', key: 'payment_date', kind: 'date' },
  { header: 'Rent Cycle', key: 'for_month', kind: 'date', required: true },
  { header: 'Mode', key: 'payment_mode', kind: 'text', oneOf: PAYMENT_MODES },
  { header: 'Status', key: 'status', kind: 'text', oneOf: RENT_STATUSES },
  { header: 'Late Fee', key: 'late_fee', kind: 'number' },
  { header: 'Discount', key: 'discount', kind: 'number' },
  { header: 'Receipt No', key: 'receipt_number', kind: 'text' },
  { header: 'Receipt', key: 'receipt_url', kind: 'text' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const LOANS: Col[] = [
  { header: 'Ref', key: 'ref', kind: 'number', required: true },
  { header: 'Lender Type', key: 'lender_type', kind: 'text', oneOf: LENDER_TYPES },
  { header: 'Loan For', key: 'lender_name', kind: 'text' },
  { header: 'Amount', key: 'amount', kind: 'number', required: true },
  { header: 'Taken On', key: 'taken_on', kind: 'date' },
  { header: 'Interest', key: 'interest_note', kind: 'text' },
  { header: 'Taken Till', key: 'taken_till', kind: 'date' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const REPAYMENTS: Col[] = [
  { header: 'Loan Ref', key: 'loan_ref', kind: 'number', required: true },
  { header: 'Amount', key: 'amount', kind: 'number', required: true },
  { header: 'Paid On', key: 'payment_date', kind: 'date' },
  { header: 'Notes', key: 'notes', kind: 'text' },
  { header: 'Photos', key: 'receipt_urls', kind: 'urls' },
]
const EXPENSES: Col[] = [
  { header: 'Category', key: 'category', kind: 'text', required: true, oneOf: EXPENSE_CATEGORIES },
  { header: 'Amount', key: 'amount', kind: 'number', required: true },
  { header: 'Date', key: 'expense_date', kind: 'date' },
  { header: 'Description', key: 'description', kind: 'text' },
  { header: 'Receipts', key: 'invoice_urls', kind: 'urls' },
]
const INCOMES: Col[] = [
  { header: 'Category', key: 'category', kind: 'text', required: true, oneOf: INCOME_CATEGORIES },
  { header: 'Amount', key: 'amount', kind: 'number', required: true },
  { header: 'Date', key: 'income_date', kind: 'date' },
  { header: 'Description', key: 'description', kind: 'text' },
]

const SHEET_WIDTH = 19 // widest table (Tenants)

// ---- writing ---------------------------------------------------------------

function toCell(value: unknown, kind: Kind): SheetCell {
  if (value === null || value === undefined || value === '') return null
  if (kind === 'number') return Number(value)
  if (kind === 'urls') return Array.isArray(value) && value.length > 0 ? value.join(' ') : null
  if (kind === 'date') return String(value).slice(0, 10)
  return String(value)
}

function bold(value: string): SheetCell {
  return { value, fontWeight: 'bold' }
}

function table(title: string, cols: Col[], rows: Row[]): SheetCell[][] {
  return [
    [bold(title)],
    cols.map((c) => bold(c.header)),
    ...rows.map((r) => cols.map((c) => toCell(r[c.key], c.kind))),
    [],
  ]
}

/** Lays a backup out as the three sheets. */
export function backupToSheets(backup: Backup): OutSheet[] {
  const floorNumberById = new Map(backup.floors.map((f) => [f.id as string, f.floor_number]))
  const houseById = new Map(
    backup.houses.map((h) => [h.id as string, { floor_number: floorNumberById.get(h.floor_id as string), house_number: h.house_number }]),
  )
  const tenantRefById = new Map(backup.tenants.map((t, i) => [t.id as string, i + 1]))
  const loanRefById = new Map(backup.loans.map((l, i) => [l.id as string, i + 1]))

  const houses = backup.houses.map((h) => ({ ...h, floor_number: floorNumberById.get(h.floor_id as string) }))
  const tenants = backup.tenants.map((t, i) => ({
    ...t,
    ref: i + 1,
    ...(typeof t.house_id === 'string' ? houseById.get(t.house_id) : {}),
  }))
  const payments = backup.payments.map((p) => ({ ...p, tenant_ref: tenantRefById.get(p.tenant_id as string) }))
  const loans = backup.loans.map((l, i) => ({ ...l, ref: i + 1 }))
  const repayments = backup.loanRepayments.map((r) => ({ ...r, loan_ref: loanRefById.get(r.loan_id as string) }))

  return [
    {
      sheet: 'Residency',
      data: [
        ...table('Floors', FLOORS, backup.floors),
        ...table('Houses', HOUSES, houses),
        ...table('Tenants', TENANTS, tenants),
        ...table('Payments', PAYMENTS, payments),
      ],
    },
    { sheet: 'Loans', data: [...table('Loans', LOANS, loans), ...table('Repayments', REPAYMENTS, repayments)] },
    { sheet: 'Expenses', data: [...table('Expenses', EXPENSES, backup.expenses), ...table('Income', INCOMES, backup.incomes)] },
  ]
}

export const SHEET_COLUMN_WIDTHS = Array.from({ length: SHEET_WIDTH }, () => ({ width: 20 }))

// ---- reading ---------------------------------------------------------------

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseValue(raw: unknown, col: Col, where: string): unknown {
  if (isBlank(raw)) return undefined
  const fail = (what: string) => new BackupError(`${where}: "${col.header}" ${what}.`)

  if (col.kind === 'number') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim())
    if (!Number.isFinite(n)) throw fail('must be a number')
    return n
  }
  if (col.kind === 'date') {
    if (raw instanceof Date) return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`
    const text = String(raw).trim()
    if (!/^\d{4}-\d{2}-\d{2}/.test(text)) throw fail('must be a date like 2026-11-25')
    return text.slice(0, 10)
  }
  if (col.kind === 'urls') return String(raw).split(/\s+/).filter(Boolean)

  const text = String(raw).trim()
  if (col.oneOf) {
    const match = col.oneOf.find((o) => o === text.toLowerCase().replace(/\s+/g, '_'))
    if (!match) throw fail(`must be one of: ${col.oneOf.join(', ')}`)
    return match
  }
  return text
}

/** Reads the table with the given title out of a sheet. */
function readTable(sheet: InSheet | undefined, title: string, cols: Col[]): Row[] {
  if (!sheet) return []
  const rows = sheet.data
  const start = rows.findIndex((r) => typeof r[0] === 'string' && r[0].trim().toLowerCase() === title.toLowerCase())
  if (start === -1) return []

  const headerRow = rows[start + 1] ?? []
  const index = new Map<string, number>()
  headerRow.forEach((h, i) => {
    if (typeof h === 'string') index.set(h.trim().toLowerCase(), i)
  })
  for (const col of cols) {
    if (col.required && !index.has(col.header.toLowerCase())) {
      throw new BackupError(`${sheet.sheet} sheet: the ${title} table is missing its "${col.header}" column.`)
    }
  }

  const out: Row[] = []
  for (let i = start + 2; i < rows.length; i++) {
    const cells = rows[i] ?? []
    if (cells.every(isBlank)) break
    const where = `${sheet.sheet} sheet, ${title} row ${i - start - 1}`
    const row: Row = {}
    for (const col of cols) {
      const at = index.get(col.header.toLowerCase())
      const value = at === undefined ? undefined : parseValue(cells[at], col, where)
      if (value === undefined) {
        if (col.required) throw new BackupError(`${where}: "${col.header}" is required.`)
      } else {
        row[col.key] = value
      }
    }
    out.push(row)
  }
  return out
}

function findSheet(sheets: InSheet[], name: string): InSheet | undefined {
  return sheets.find((s) => s.sheet.trim().toLowerCase() === name.toLowerCase())
}

function uniqueRefs(rows: Row[], key: string, what: string): void {
  const seen = new Set<unknown>()
  for (const r of rows) {
    if (seen.has(r[key])) throw new BackupError(`${what}: "${key === 'ref' ? 'Ref' : key}" ${String(r[key])} appears more than once.`)
    seen.add(r[key])
  }
}

/** Turns the sheets of an exported file back into records, linking them with fresh keys. */
export function sheetsToBackup(sheets: InSheet[]): Backup {
  const residency = findSheet(sheets, 'Residency')
  const loansSheet = findSheet(sheets, 'Loans')
  const expensesSheet = findSheet(sheets, 'Expenses')
  if (!residency && !loansSheet && !expensesSheet) {
    throw new BackupError('That file is not a Jeevanam export — it has no Residency, Loans or Expenses sheet.')
  }

  const floorRows = readTable(residency, 'Floors', FLOORS)
  const houseRows = readTable(residency, 'Houses', HOUSES)
  const tenantRows = readTable(residency, 'Tenants', TENANTS)
  const paymentRows = readTable(residency, 'Payments', PAYMENTS)
  const loanRows = readTable(loansSheet, 'Loans', LOANS)
  const repaymentRows = readTable(loansSheet, 'Repayments', REPAYMENTS)

  uniqueRefs(tenantRows, 'ref', 'Residency sheet, Tenants')
  uniqueRefs(loanRows, 'ref', 'Loans sheet, Loans')

  const floorIdByNumber = new Map<number, string>()
  const floors = floorRows.map((r, i) => {
    const id = `f${i + 1}`
    if (floorIdByNumber.has(r.floor_number as number)) {
      throw new BackupError(`Residency sheet, Floors: floor ${String(r.floor_number)} appears more than once.`)
    }
    floorIdByNumber.set(r.floor_number as number, id)
    return { id, floor_number: r.floor_number, name: r.name }
  })

  const houseIdByKey = new Map<string, string>()
  const houses = houseRows.map((r, i) => {
    const floorId = floorIdByNumber.get(r.floor_number as number)
    if (!floorId) throw new BackupError(`Residency sheet, Houses row ${i + 1}: floor ${String(r.floor_number)} is not in the Floors table.`)
    const key = `${String(r.floor_number)}|${String(r.house_number)}`
    if (houseIdByKey.has(key)) {
      throw new BackupError(`Residency sheet, Houses row ${i + 1}: house ${String(r.house_number)} appears more than once on that floor.`)
    }
    const id = `h${i + 1}`
    houseIdByKey.set(key, id)
    const { floor_number: _floor, ...rest } = r
    return { ...rest, id, floor_id: floorId }
  })

  const tenants = tenantRows.map((r, i) => {
    const { ref, floor_number, house_number, ...rest } = r
    let houseId: string | undefined
    if (floor_number !== undefined || house_number !== undefined) {
      houseId = houseIdByKey.get(`${String(floor_number)}|${String(house_number)}`)
      if (!houseId) {
        throw new BackupError(`Residency sheet, Tenants row ${i + 1}: house ${String(house_number)} on floor ${String(floor_number)} is not in the Houses table.`)
      }
    }
    return { ...rest, id: `t${String(ref)}`, house_id: houseId ?? null }
  })
  const tenantIds = new Set(tenants.map((t) => t.id))

  const payments = paymentRows.map((r, i) => {
    const { tenant_ref, ...rest } = r
    const tenantId = `t${String(tenant_ref)}`
    if (!tenantIds.has(tenantId)) throw new BackupError(`Residency sheet, Payments row ${i + 1}: there is no tenant with Ref ${String(tenant_ref)}.`)
    return { ...rest, id: `p${i + 1}`, tenant_id: tenantId }
  })

  const loans = loanRows.map((r) => {
    const { ref, ...rest } = r
    return { ...rest, id: `l${String(ref)}` }
  })
  const loanIds = new Set(loans.map((l) => l.id))

  const loanRepayments = repaymentRows.map((r, i) => {
    const { loan_ref, ...rest } = r
    const loanId = `l${String(loan_ref)}`
    if (!loanIds.has(loanId)) throw new BackupError(`Loans sheet, Repayments row ${i + 1}: there is no loan with Ref ${String(loan_ref)}.`)
    return { ...rest, id: `r${i + 1}`, loan_id: loanId }
  })

  return {
    floors,
    houses,
    tenants,
    payments,
    loans,
    loanRepayments,
    expenses: readTable(expensesSheet, 'Expenses', EXPENSES),
    incomes: readTable(expensesSheet, 'Income', INCOMES),
  }
}
