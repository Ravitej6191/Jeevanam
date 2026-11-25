import { describe, expect, it } from 'vitest'
import { BackupError, backupToSheets, sheetsToBackup, type Backup, type InSheet, type SheetCell } from './excel-format'

const backup: Backup = {
  floors: [{ id: 'F-a', floor_number: 1, name: 'Ground Floor' }],
  houses: [{ id: 'H-a', floor_id: 'F-a', house_number: 'G1', gas_connection_number: '123', electricity_bill_number: null, notes: null }],
  tenants: [
    {
      id: 'T-a', house_id: 'H-a', name: 'Suresh Kumar', phone: '9876543210', aadhaar_number: null, occupation: 'Driver',
      address: null, joining_date: '2026-11-05', vacating_date: null, status: 'active', rent: 8000, deposit: 16000, advance: 0,
      deposit_paid_amount: null, deposit_paid_date: null, photo_url: 'https://x.test/a.jpg', deposit_screenshot_url: null, notes: null,
    },
    { id: 'T-b', house_id: null, name: 'Asha', phone: '9000000000', joining_date: '2026-11-20', status: 'active', rent: 5000, deposit: 0, advance: 0 },
  ],
  payments: [
    { id: 'P-a', tenant_id: 'T-a', amount: 8000, payment_date: '2026-11-05', for_month: '2026-11-01', payment_mode: 'upi', status: 'paid', late_fee: 0, discount: 0, receipt_number: 'RCPT-1', receipt_url: null, notes: null },
  ],
  loans: [{ id: 'L-a', lender_type: 'bank', lender_name: 'Home', amount: 150000, taken_on: '2026-11-25', interest_note: null, taken_till: null, notes: null }],
  loanRepayments: [
    { id: 'R-a', loan_id: 'L-a', amount: 5000, payment_date: '2026-11-26', notes: 'first', receipt_urls: ['https://x.test/r1.jpg', 'https://x.test/r2.jpg'] },
  ],
  expenses: [{ id: 'E-a', category: 'groceries', amount: 1200, expense_date: '2026-11-25', description: 'Rice', invoice_urls: [] }],
  incomes: [{ id: 'I-a', category: 'salary', amount: 30000, income_date: '2026-11-01', description: null }],
}

/** What a spreadsheet reader would hand back for the written sheets. */
function asRead(sheets: ReturnType<typeof backupToSheets>): InSheet[] {
  const plain = (c: SheetCell) => (c !== null && typeof c === 'object' ? c.value : c)
  return sheets.map((s) => ({ sheet: s.sheet, data: s.data.map((row) => row.map(plain)) }))
}

describe('Excel export layout', () => {
  it('has the Residency, Loans and Expenses sheets', () => {
    expect(backupToSheets(backup).map((s) => s.sheet)).toEqual(['Residency', 'Loans', 'Expenses'])
  })

  it('writes empty tables as just their headers', () => {
    const empty: Backup = { floors: [], houses: [], tenants: [], payments: [], loans: [], loanRepayments: [], expenses: [], incomes: [] }
    const restored = sheetsToBackup(asRead(backupToSheets(empty)))
    expect(restored.tenants).toEqual([])
    expect(restored.expenses).toEqual([])
  })

  it('round-trips records and keeps them linked', () => {
    const restored = sheetsToBackup(asRead(backupToSheets(backup)))

    expect(restored.floors).toEqual([{ id: 'f1', floor_number: 1, name: 'Ground Floor' }])
    expect(restored.houses).toEqual([
      { id: 'h1', floor_id: 'f1', house_number: 'G1', gas_connection_number: '123' },
    ])
    expect(restored.tenants[0]).toMatchObject({ id: 't1', house_id: 'h1', name: 'Suresh Kumar', rent: 8000, joining_date: '2026-11-05' })
    expect(restored.tenants[1]).toMatchObject({ id: 't2', house_id: null, name: 'Asha' })
    expect(restored.payments).toHaveLength(1)
    expect(restored.payments[0]).toMatchObject({ tenant_id: 't1', amount: 8000, for_month: '2026-11-01', payment_mode: 'upi' })
    expect(restored.loans[0]).toMatchObject({ id: 'l1', amount: 150000, lender_type: 'bank' })
    expect(restored.loanRepayments[0]).toMatchObject({ loan_id: 'l1', amount: 5000, receipt_urls: ['https://x.test/r1.jpg', 'https://x.test/r2.jpg'] })
    expect(restored.expenses[0]).toMatchObject({ category: 'groceries', amount: 1200 })
    expect(restored.incomes[0]).toMatchObject({ category: 'salary', amount: 30000 })
  })

  it('accepts dates typed into Excel', () => {
    const sheets = asRead(backupToSheets(backup))
    const expenses = sheets.find((s) => s.sheet === 'Expenses')!
    const dateRow = expenses.data.findIndex((r) => r[0] === 'groceries')
    expenses.data[dateRow]![2] = new Date(2026, 10, 3)
    expect(sheetsToBackup(sheets).expenses[0]).toMatchObject({ expense_date: '2026-11-03' })
  })
})

describe('Excel import errors', () => {
  it('rejects a file with none of the three sheets', () => {
    expect(() => sheetsToBackup([{ sheet: 'Sheet1', data: [['a']] }])).toThrow(BackupError)
  })

  it('names the sheet, table and row of a bad value', () => {
    const sheets = asRead(backupToSheets(backup))
    const loans = sheets.find((s) => s.sheet === 'Loans')!
    const row = loans.data.findIndex((r) => r[0] === 1 && r[3] === 150000)
    loans.data[row]![3] = 'lots'
    expect(() => sheetsToBackup(sheets)).toThrow(/Loans sheet, Loans row 1: "Amount" must be a number/)
  })

  it('rejects an unknown category', () => {
    const sheets = asRead(backupToSheets(backup))
    const expenses = sheets.find((s) => s.sheet === 'Expenses')!
    expenses.data[expenses.data.findIndex((r) => r[0] === 'groceries')]![0] = 'snacks'
    expect(() => sheetsToBackup(sheets)).toThrow(/"Category" must be one of/)
  })

  it('rejects a payment for a tenant that is not listed', () => {
    const sheets = asRead(backupToSheets(backup))
    const residency = sheets.find((s) => s.sheet === 'Residency')!
    const row = residency.data.findIndex((r) => r[0] === 1 && r[1] === 8000)
    residency.data[row]![0] = 99
    expect(() => sheetsToBackup(sheets)).toThrow(/no tenant with Ref 99/)
  })
})
