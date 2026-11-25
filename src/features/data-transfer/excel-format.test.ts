import { describe, expect, it } from 'vitest'
import { backupToSheets, type Backup, type SheetCell } from './excel-format'

const backup: Backup = {
  floors: [{ id: 'F1', floor_number: 1, name: 'Ground Floor' }],
  houses: [{ id: 'H1', floor_id: 'F1', house_number: 'G1', gas_connection_number: '123', electricity_bill_number: null, notes: null }],
  tenants: [
    { id: 'T1', house_id: 'H1', name: 'Suresh Kumar', phone: '9876543210', joining_date: '2026-11-05', status: 'active', rent: 8000, deposit: 16000, advance: 0 },
    { id: 'T2', house_id: null, name: 'Asha', phone: '9000000000', joining_date: '2026-11-20', status: 'vacated', rent: 5000, deposit: 0, advance: 0 },
  ],
  payments: [
    { id: 'P1', tenant_id: 'T1', amount: 8000, payment_date: '2026-11-05', for_month: '2026-11-01', payment_mode: 'bank_transfer', status: 'paid', late_fee: 0, discount: 0 },
    { id: 'P2', tenant_id: 'T1', amount: 8000, payment_date: '2026-12-05', for_month: '2026-12-01', payment_mode: 'upi', status: 'paid', late_fee: 0, discount: 0 },
  ],
  loans: [
    { id: 'L1', lender_type: 'hand_cash', lender_name: 'Marriage', amount: 150000, taken_on: '2026-11-25' },
    { id: 'L2', lender_type: 'bank', lender_name: null, amount: 50000, taken_on: '2026-10-01' },
  ],
  loanRepayments: [
    { id: 'R1', loan_id: 'L1', amount: 5000, payment_date: '2026-11-26', notes: 'first' },
    { id: 'R2', loan_id: 'L1', amount: 20000, payment_date: '2026-12-02', notes: null },
  ],
  expenses: [
    { id: 'E1', category: 'groceries', amount: 1200, expense_date: '2026-11-25', description: 'Rice' },
    { id: 'E2', category: 'misc', amount: 300, expense_date: '2026-11-28', description: null },
  ],
  incomes: [{ id: 'I1', category: 'salary', amount: 30000, income_date: '2026-11-01', description: null }],
}

const plain = (c: SheetCell) => (c !== null && typeof c === 'object' ? c.value : c)

/** The rows of the table with the given title on a sheet, keyed by header. */
function tableRows(sheetName: string, title: string): Record<string, SheetCell>[] {
  const sheet = backupToSheets(backup).find((s) => s.sheet === sheetName)!
  const rows = sheet.data.map((r) => r.map(plain))
  const start = rows.findIndex((r) => r[0] === title)
  expect(start).toBeGreaterThanOrEqual(0)
  const headers = rows[start + 1] as string[]
  const out: Record<string, SheetCell>[] = []
  for (let i = start + 2; i < rows.length && rows[i]!.length > 0; i++) {
    out.push(Object.fromEntries(headers.map((h, c) => [h, rows[i]![c] ?? null])))
  }
  return out
}

describe('Excel export layout', () => {
  it('has the Residency, Loans and Expenses sheets', () => {
    expect(backupToSheets(backup).map((s) => s.sheet)).toEqual(['Residency', 'Loans', 'Expenses'])
  })

  it('puts the house and floor on each tenant, and names the tenant on each payment', () => {
    const tenants = tableRows('Residency', 'Tenants')
    expect(tenants[0]).toMatchObject({ Name: 'Suresh Kumar', Floor: 'Ground Floor', 'House No': 'G1', Rent: 8000, Status: 'Active' })
    expect(tenants[1]).toMatchObject({ Name: 'Asha', Floor: null, 'House No': null, Status: 'Vacated' })

    const payments = tableRows('Residency', 'Payments')
    expect(payments.map((p) => p.Tenant)).toEqual(['Suresh Kumar', 'Suresh Kumar'])
    expect(payments[0]).toMatchObject({ 'Paid On': '2026-12-05', Mode: 'Upi' }) // newest first
    expect(payments[1]).toMatchObject({ Mode: 'Bank Transfer' })
  })

  it('shows paid and balance for each loan, newest first', () => {
    const loans = tableRows('Loans', 'Loans')
    expect(loans[0]).toMatchObject({ 'Loan For': 'Marriage', Type: 'Hand Cash', Amount: 150000, Paid: 25000, Balance: 125000 })
    expect(loans[1]).toMatchObject({ 'Loan For': 'Bank', Paid: 0, Balance: 50000 })
  })

  it('names the loan on each repayment', () => {
    expect(tableRows('Loans', 'Repayments').map((r) => r.Loan)).toEqual(['Marriage', 'Marriage'])
  })

  it('lists expenses and income with readable categories', () => {
    expect(tableRows('Expenses', 'Expenses').map((e) => e.Category)).toEqual(['Misc', 'Groceries'])
    expect(tableRows('Expenses', 'Income')[0]).toMatchObject({ Category: 'Salary', Amount: 30000 })
  })

  it('writes empty tables as just their headers', () => {
    const empty: Backup = { floors: [], houses: [], tenants: [], payments: [], loans: [], loanRepayments: [], expenses: [], incomes: [] }
    const sheets = backupToSheets(empty)
    expect(sheets).toHaveLength(3)
    expect(sheets[2]!.data.length).toBeGreaterThan(0)
  })
})
