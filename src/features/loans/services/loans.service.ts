import { supabase } from '@/lib/supabase'
import type { LenderType } from '@/types/database.types'
import { pushSupabaseNotification } from '@/features/notifications/services/notifications.service'
import { formatCurrency } from '@/utils/format'
import type { Loan, LoanRepayment } from '../types'

export async function getLoans(): Promise<Loan[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (buildingError) throw buildingError

  const { data: loanRows, error: loansError } = await supabase
    .from('loans')
    .select('*')
    .eq('building_id', buildingRow.id)
    .order('taken_on', { ascending: false })
  if (loansError) throw loansError

  const loanIds = loanRows.map((l) => l.id)
  const paidByLoanId = new Map<string, number>()
  if (loanIds.length > 0) {
    const { data: repayments, error: repaymentsError } = await supabase
      .from('loan_repayments')
      .select('loan_id, amount')
      .in('loan_id', loanIds)
    if (repaymentsError) throw repaymentsError
    for (const r of repayments) {
      paidByLoanId.set(r.loan_id, (paidByLoanId.get(r.loan_id) ?? 0) + r.amount)
    }
  }

  return loanRows.map((row) => {
    const paidTillNow = paidByLoanId.get(row.id) ?? 0
    return {
      id: row.id,
      lenderType: row.lender_type,
      lenderName: row.lender_name,
      amount: row.amount,
      interestNote: row.interest_note,
      takenOn: row.taken_on,
      takenTill: row.taken_till,
      notes: row.notes,
      paidTillNow,
      stillToPay: Math.max(0, row.amount - paidTillNow),
      createdAt: row.created_at,
    }
  })
}

export async function getLoanRepayments(loanId: string): Promise<LoanRepayment[]> {
  const { data, error } = await supabase
    .from('loan_repayments')
    .select('id, loan_id, amount, payment_date, notes, receipt_urls, created_at')
    .eq('loan_id', loanId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error

  return data.map((r) => ({
    id: r.id,
    loanId: r.loan_id,
    amount: r.amount,
    paymentDate: r.payment_date,
    notes: r.notes,
    imageUrls: r.receipt_urls ?? [],
    createdAt: r.created_at,
  }))
}

export interface CreateLoanInput {
  lenderType: LenderType
  lenderName: string | null
  amount: number
  interestNote: string | null
  takenOn: string
  takenTill: string | null
  notes: string | null
}

export async function createLoan(input: CreateLoanInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (buildingError) throw buildingError

  const { error } = await supabase.from('loans').insert({
    building_id: buildingRow.id,
    lender_type: input.lenderType,
    lender_name: input.lenderName,
    amount: input.amount,
    interest_note: input.interestNote,
    taken_on: input.takenOn,
    taken_till: input.takenTill,
    notes: input.notes,
  })
  if (error) throw error

  await pushSupabaseNotification(buildingRow.id, 'loan', 'Loan added', `${formatCurrency(input.amount)} loan recorded.`)
}

export interface EditLoanInput extends CreateLoanInput {
  id: string
}

export async function updateLoan(input: EditLoanInput): Promise<void> {
  const { error } = await supabase
    .from('loans')
    .update({
      lender_type: input.lenderType,
      lender_name: input.lenderName,
      amount: input.amount,
      interest_note: input.interestNote,
      taken_on: input.takenOn,
      taken_till: input.takenTill,
      notes: input.notes,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function deleteLoan(loanId: string): Promise<void> {
  const { error } = await supabase.from('loans').delete().eq('id', loanId)
  if (error) throw error
}

export interface CreateLoanRepaymentInput {
  loanId: string
  amount: number
  paymentDate: string
  notes: string | null
  imageUrls: string[]
}

export async function createLoanRepayment(input: CreateLoanRepaymentInput): Promise<void> {
  const { data: loanRow, error: loanError } = await supabase
    .from('loans')
    .select('building_id')
    .eq('id', input.loanId)
    .single()
  if (loanError) throw loanError

  const { error } = await supabase.from('loan_repayments').insert({
    loan_id: input.loanId,
    amount: input.amount,
    payment_date: input.paymentDate,
    notes: input.notes,
    receipt_urls: input.imageUrls,
  })
  if (error) throw error

  await pushSupabaseNotification(
    loanRow.building_id,
    'loan_repayment',
    'Loan repayment recorded',
    `${formatCurrency(input.amount)} repaid towards a loan.`,
  )
}

export interface EditLoanRepaymentInput {
  id: string
  amount: number
  paymentDate: string
  notes: string | null
  imageUrls: string[]
}

export async function updateLoanRepayment(input: EditLoanRepaymentInput): Promise<void> {
  const { error } = await supabase
    .from('loan_repayments')
    .update({
      amount: input.amount,
      payment_date: input.paymentDate,
      notes: input.notes,
      receipt_urls: input.imageUrls,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function deleteLoanRepayment(repaymentId: string): Promise<void> {
  const { error } = await supabase.from('loan_repayments').delete().eq('id', repaymentId)
  if (error) throw error
}
