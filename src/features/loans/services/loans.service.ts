import { isDemoSession } from '@/config/env'
import { supabase } from '@/lib/supabase'
import {
  addLoan as demoAddLoan,
  addLoanRepayment as demoAddLoanRepayment,
  updateLoanRepayment as demoUpdateLoanRepayment,
  deleteLoan as demoDeleteLoan,
  deleteLoanRepayment as demoDeleteLoanRepayment,
  getDemoDb,
  updateLoan as demoUpdateLoan,
  type AddLoanInput,
  type AddLoanRepaymentInput,
  type UpdateLoanInput,
  type UpdateLoanRepaymentInput,
} from '@/lib/demo-store'
import { pushSupabaseNotification } from '@/features/notifications/services/notifications.service'
import { formatCurrency } from '@/utils/format'
import type { Loan, LoanRepayment } from '../types'

export async function getLoans(): Promise<Loan[]> {
  if (isDemoSession()) {
    const db = getDemoDb()
    return db.loans
      .map((l) => {
        const paidTillNow = db.loanRepayments.filter((r) => r.loanId === l.id).reduce((sum, r) => sum + r.amount, 0)
        return {
          id: l.id,
          lenderType: l.lenderType,
          lenderName: l.lenderName,
          amount: l.amount,
          interestNote: l.interestNote,
          takenOn: l.takenOn,
          takenTill: l.takenTill,
          notes: l.notes,
          paidTillNow,
          stillToPay: Math.max(0, l.amount - paidTillNow),
          createdAt: l.createdAt,
        }
      })
      .sort((a, b) => b.takenOn.localeCompare(a.takenOn))
  }

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

/** Newest repayment first — by the date it was paid, then by when it was entered. */
function byNewestRepayment(a: { paymentDate: string; createdAt: string }, b: { paymentDate: string; createdAt: string }): number {
  return b.paymentDate.localeCompare(a.paymentDate) || b.createdAt.localeCompare(a.createdAt)
}

export async function getLoanRepayments(loanId: string): Promise<LoanRepayment[]> {
  if (isDemoSession()) {
    return getDemoDb()
      .loanRepayments.filter((r) => r.loanId === loanId)
      .map((r) => ({
        id: r.id,
        loanId: r.loanId,
        amount: r.amount,
        paymentDate: r.paymentDate,
        notes: r.notes,
        imageUrls: r.imageUrls ?? [],
        createdAt: r.createdAt,
      }))
      .sort(byNewestRepayment)
  }

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

export type CreateLoanInput = AddLoanInput

export async function createLoan(input: CreateLoanInput): Promise<void> {
  if (isDemoSession()) {
    demoAddLoan(input)
    return
  }

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

  await pushSupabaseNotification(buildingRow.id, 'expense', 'Loan added', `${formatCurrency(input.amount)} loan recorded.`)
}

export type EditLoanInput = UpdateLoanInput

export async function updateLoan(input: EditLoanInput): Promise<void> {
  if (isDemoSession()) {
    demoUpdateLoan(input)
    return
  }

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
  if (isDemoSession()) {
    demoDeleteLoan(loanId)
    return
  }

  const { error } = await supabase.from('loans').delete().eq('id', loanId)
  if (error) throw error
}

export type CreateLoanRepaymentInput = AddLoanRepaymentInput

export async function createLoanRepayment(input: CreateLoanRepaymentInput): Promise<void> {
  if (isDemoSession()) {
    demoAddLoanRepayment(input)
    return
  }

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
    'expense',
    'Loan repayment recorded',
    `${formatCurrency(input.amount)} repaid towards a loan.`,
  )
}

export type EditLoanRepaymentInput = UpdateLoanRepaymentInput

export async function updateLoanRepayment(input: EditLoanRepaymentInput): Promise<void> {
  if (isDemoSession()) {
    demoUpdateLoanRepayment(input)
    return
  }

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
  if (isDemoSession()) {
    demoDeleteLoanRepayment(repaymentId)
    return
  }

  const { error } = await supabase.from('loan_repayments').delete().eq('id', repaymentId)
  if (error) throw error
}
