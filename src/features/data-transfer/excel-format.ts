/**
 * Layout of the Excel export — pure functions, no spreadsheet library.
 *
 * Three sheets (Residency, Loans, Expenses), each holding one or more small
 * tables stacked top to bottom: a bold title row, a bold header row, the data
 * rows, then a blank row.
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

type Kind = 'text' | 'number' | 'date' | 'label'

interface Col {
  header: string
  key: string
  kind: Kind
}

const FLOORS: Col[] = [
  { header: 'Floor No', key: 'floor_number', kind: 'number' },
  { header: 'Floor Name', key: 'name', kind: 'text' },
]
const HOUSES: Col[] = [
  { header: 'Floor', key: 'floor_name', kind: 'text' },
  { header: 'House No', key: 'house_number', kind: 'text' },
  { header: 'Gas Connection No', key: 'gas_connection_number', kind: 'text' },
  { header: 'Electricity Bill No', key: 'electricity_bill_number', kind: 'text' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const TENANTS: Col[] = [
  { header: 'Name', key: 'name', kind: 'text' },
  { header: 'Phone', key: 'phone', kind: 'text' },
  { header: 'Aadhaar', key: 'aadhaar_number', kind: 'text' },
  { header: 'Occupation', key: 'occupation', kind: 'text' },
  { header: 'Address', key: 'address', kind: 'text' },
  { header: 'Floor', key: 'floor_name', kind: 'text' },
  { header: 'House No', key: 'house_number', kind: 'text' },
  { header: 'Rent Cycle Starts', key: 'joining_date', kind: 'date' },
  { header: 'Vacated On', key: 'vacating_date', kind: 'date' },
  { header: 'Status', key: 'status', kind: 'label' },
  { header: 'Rent', key: 'rent', kind: 'number' },
  { header: 'Deposit', key: 'deposit', kind: 'number' },
  { header: 'Advance', key: 'advance', kind: 'number' },
  { header: 'Deposit Paid', key: 'deposit_paid_amount', kind: 'number' },
  { header: 'Deposit Paid On', key: 'deposit_paid_date', kind: 'date' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const PAYMENTS: Col[] = [
  { header: 'Tenant', key: 'tenant_name', kind: 'text' },
  { header: 'Paid On', key: 'payment_date', kind: 'date' },
  { header: 'Rent Cycle', key: 'for_month', kind: 'date' },
  { header: 'Amount', key: 'amount', kind: 'number' },
  { header: 'Mode', key: 'payment_mode', kind: 'label' },
  { header: 'Status', key: 'status', kind: 'label' },
  { header: 'Late Fee', key: 'late_fee', kind: 'number' },
  { header: 'Discount', key: 'discount', kind: 'number' },
  { header: 'Receipt No', key: 'receipt_number', kind: 'text' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const LOANS: Col[] = [
  { header: 'Loan For', key: 'lender_name', kind: 'text' },
  { header: 'Type', key: 'lender_type', kind: 'label' },
  { header: 'Taken On', key: 'taken_on', kind: 'date' },
  { header: 'Amount', key: 'amount', kind: 'number' },
  { header: 'Paid', key: 'paid', kind: 'number' },
  { header: 'Balance', key: 'balance', kind: 'number' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const REPAYMENTS: Col[] = [
  { header: 'Loan', key: 'loan_name', kind: 'text' },
  { header: 'Paid On', key: 'payment_date', kind: 'date' },
  { header: 'Amount', key: 'amount', kind: 'number' },
  { header: 'Notes', key: 'notes', kind: 'text' },
]
const EXPENSES: Col[] = [
  { header: 'Date', key: 'expense_date', kind: 'date' },
  { header: 'Category', key: 'category', kind: 'label' },
  { header: 'Description', key: 'description', kind: 'text' },
  { header: 'Amount', key: 'amount', kind: 'number' },
]
const INCOMES: Col[] = [
  { header: 'Date', key: 'income_date', kind: 'date' },
  { header: 'Category', key: 'category', kind: 'label' },
  { header: 'Description', key: 'description', kind: 'text' },
  { header: 'Amount', key: 'amount', kind: 'number' },
]

const WIDEST_TABLE = 16 // Tenants

export const SHEET_COLUMN_WIDTHS = Array.from({ length: WIDEST_TABLE }, () => ({ width: 20 }))

/** "hand_cash" → "Hand Cash"; the app's own labels use this style. */
function prettify(value: string): string {
  return value
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function toCell(value: unknown, kind: Kind): SheetCell {
  if (value === null || value === undefined || value === '') return null
  if (kind === 'number') return Number(value)
  if (kind === 'date') return String(value).slice(0, 10)
  if (kind === 'label') return prettify(String(value))
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

/** Lays the owner's records out as the three sheets. */
export function backupToSheets(backup: Backup): OutSheet[] {
  const floorNameById = new Map(backup.floors.map((f) => [f.id as string, f.name]))
  const houseById = new Map(
    backup.houses.map((h) => [h.id as string, { floor_name: floorNameById.get(h.floor_id as string), house_number: h.house_number }]),
  )
  const tenantNameById = new Map(backup.tenants.map((t) => [t.id as string, t.name]))

  const houses = backup.houses.map((h) => ({ ...h, floor_name: floorNameById.get(h.floor_id as string) }))
  const tenants = backup.tenants.map((t) => ({
    ...t,
    ...(typeof t.house_id === 'string' ? houseById.get(t.house_id) : {}),
  }))
  const payments = backup.payments.map((p) => ({ ...p, tenant_name: tenantNameById.get(p.tenant_id as string) }))

  const paidByLoan = new Map<string, number>()
  for (const r of backup.loanRepayments) {
    const id = r.loan_id as string
    paidByLoan.set(id, (paidByLoan.get(id) ?? 0) + Number(r.amount))
  }
  const loanNameById = new Map<string, string>()
  const loans = backup.loans.map((l) => {
    const paid = paidByLoan.get(l.id as string) ?? 0
    const name = (l.lender_name as string | null) || prettify(String(l.lender_type))
    loanNameById.set(l.id as string, name)
    return { ...l, lender_name: l.lender_name ?? name, paid, balance: Math.max(0, Number(l.amount) - paid) }
  })
  const repayments = backup.loanRepayments.map((r) => ({ ...r, loan_name: loanNameById.get(r.loan_id as string) }))

  const newestFirst = (dateKey: string) => (a: Row, b: Row) => String(b[dateKey] ?? '').localeCompare(String(a[dateKey] ?? ''))

  return [
    {
      sheet: 'Residency',
      data: [
        ...table('Floors', FLOORS, backup.floors),
        ...table('Houses', HOUSES, houses),
        ...table('Tenants', TENANTS, tenants),
        ...table('Payments', PAYMENTS, [...payments].sort(newestFirst('payment_date'))),
      ],
    },
    {
      sheet: 'Loans',
      data: [
        ...table('Loans', LOANS, [...loans].sort(newestFirst('taken_on'))),
        ...table('Repayments', REPAYMENTS, [...repayments].sort(newestFirst('payment_date'))),
      ],
    },
    {
      sheet: 'Expenses',
      data: [
        ...table('Expenses', EXPENSES, [...backup.expenses].sort(newestFirst('expense_date'))),
        ...table('Income', INCOMES, [...backup.incomes].sort(newestFirst('income_date'))),
      ],
    },
  ]
}
