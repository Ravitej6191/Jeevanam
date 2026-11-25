import { supabase } from '@/lib/supabase'
import { pushSupabaseNotification } from '@/features/notifications/services/notifications.service'
import { formatCurrency, todayIso } from '@/utils/format'
import { currentCycle } from '@/utils/rent-cycle'
import type { PaymentMode, RentStatus, TenantRow } from '@/types/database.types'
import type { Tenant } from '@/types/domain'

function computeRentStatus(rent: number, paidThisMonth: number): RentStatus {
  if (paidThisMonth <= 0) return 'pending'
  return paidThisMonth >= rent ? 'paid' : 'partial'
}

/** Rent status of each tenant for the cycle they're currently in — derived
 * from payments (never trusted from the stored column, which goes stale the
 * moment a new cycle starts). */
export async function getCycleStatuses(
  tenantRows: { id: string; rent: number; joining_date: string }[],
): Promise<Map<string, RentStatus>> {
  const statuses = new Map<string, RentStatus>()
  if (tenantRows.length === 0) return statuses

  const cycleKeyByTenant = new Map(tenantRows.map((t) => [t.id, currentCycle(t.joining_date).forMonth]))
  const { data, error } = await supabase
    .from('payments')
    .select('tenant_id, amount, for_month')
    .in('tenant_id', tenantRows.map((t) => t.id))
    .in('for_month', Array.from(new Set(cycleKeyByTenant.values())))
  if (error) throw error

  const paid = new Map<string, number>()
  for (const p of data) {
    if (p.for_month === cycleKeyByTenant.get(p.tenant_id)) paid.set(p.tenant_id, (paid.get(p.tenant_id) ?? 0) + p.amount)
  }
  for (const t of tenantRows) statuses.set(t.id, computeRentStatus(t.rent, paid.get(t.id) ?? 0))
  return statuses
}

function mapTenantRow(row: TenantRow, houseNumber: string, floorName: string, rentStatus: RentStatus): Tenant {
  return {
    id: row.id,
    houseId: row.house_id,
    houseNumber,
    floorName,
    name: row.name,
    phone: row.phone,
    aadhaarNumber: row.aadhaar_number,
    address: row.address,
    occupation: row.occupation,
    photoUrl: row.photo_url,
    joiningDate: row.joining_date,
    vacatingDate: row.vacating_date,
    advance: row.advance,
    deposit: row.deposit,
    rent: row.rent,
    rentStatus,
    status: row.status,
    notes: row.notes,
    depositRecord:
      row.deposit_paid_amount !== null
        ? {
            amount: row.deposit_paid_amount,
            paidDate: row.deposit_paid_date ?? '',
            screenshotUrl: row.deposit_screenshot_url,
            recordedAt: row.deposit_recorded_at ?? row.deposit_paid_date ?? '',
          }
        : null,
  }
}

export async function getTenants(): Promise<Tenant[]> {
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

  const { data: floors, error: floorsError } = await supabase
    .from('floors')
    .select('id, name')
    .eq('building_id', buildingRow.id)
  if (floorsError) throw floorsError
  const floorIds = floors.map((f) => f.id)

  const { data: houses, error: housesError } = await supabase
    .from('houses')
    .select('id, house_number, floor_id')
    .in('floor_id', floorIds)
  if (housesError) throw housesError

  const { data: tenantRows, error: tenantsError } = await supabase
    .from('tenants')
    .select('*')
    .eq('building_id', buildingRow.id)
  if (tenantsError) throw tenantsError

  const houseById = new Map(houses.map((h) => [h.id, h]))
  const floorNameById = new Map(floors.map((f) => [f.id, f.name]))

  const statusById = await getCycleStatuses(tenantRows)

  return tenantRows.map((row) => {
    const house = row.house_id ? houseById.get(row.house_id) : undefined
    const floorName = house ? (floorNameById.get(house.floor_id) ?? '') : ''
    return mapTenantRow(row, house?.house_number ?? '', floorName, statusById.get(row.id) ?? 'pending')
  })
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const tenants = await getTenants()
  return tenants.find((t) => t.id === id) ?? null
}

export interface PaymentHistoryItem {
  id: string
  amount: number
  paymentDate: string
  paymentMode: PaymentMode
  forMonth: string
  status: RentStatus
  receiptNumber: string | null
  receiptUrl: string | null
  notes: string | null
  /** When this payment was actually recorded — distinct from `paymentDate`,
   * which the user can backdate. Carries the real time of day. */
  createdAt: string
}

export async function getPaymentHistory(tenantId: string): Promise<PaymentHistoryItem[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, payment_date, payment_mode, for_month, status, receipt_number, receipt_url, notes, created_at')
    .eq('tenant_id', tenantId)
    .order('payment_date', { ascending: false })
  if (error) throw error

  return data.map((p) => ({
    id: p.id,
    amount: p.amount,
    paymentDate: p.payment_date,
    paymentMode: p.payment_mode,
    forMonth: p.for_month,
    status: p.status,
    createdAt: p.created_at,
    receiptNumber: p.receipt_number,
    receiptUrl: p.receipt_url,
    notes: p.notes,
  }))
}

export interface CreateTenantInput {
  houseId: string | null
  name: string
  phone: string
  aadhaarNumber: string | null
  occupation: string | null
  photoUrl: string | null
  /** The agreed date rent cycles are anchored to. Defaults to today. */
  joiningDate?: string
  rent: number
  deposit: number
}

export async function createTenant(input: CreateTenantInput): Promise<string> {
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

  if (input.houseId) {
    const { count, error: countError } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('house_id', input.houseId)
      .eq('status', 'active')
    if (countError) throw countError
    if ((count ?? 0) > 0) throw new Error('That house is already occupied.')
  }

  const { data, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      building_id: buildingRow.id,
      house_id: input.houseId,
      name: input.name,
      phone: input.phone,
      aadhaar_number: input.aadhaarNumber,
      occupation: input.occupation,
      photo_url: input.photoUrl,
      joining_date: input.joiningDate ?? todayIso(),
      rent: input.rent,
      deposit: input.deposit,
    })
    .select('id')
    .single()
  if (tenantError) throw tenantError

  await pushSupabaseNotification(buildingRow.id, 'tenant', 'Tenant added', `${input.name} was added as a tenant.`)

  return data.id
}

export interface UpdateTenantInput {
  id: string
  name: string
  phone: string
  aadhaarNumber: string | null
  occupation: string | null
  photoUrl: string | null
  joiningDate: string
  rent: number
  deposit: number
}

export async function updateTenant(input: UpdateTenantInput): Promise<void> {
  const { error } = await supabase
    .from('tenants')
    .update({
      name: input.name,
      phone: input.phone,
      aadhaar_number: input.aadhaarNumber,
      occupation: input.occupation,
      photo_url: input.photoUrl,
      joining_date: input.joiningDate,
      rent: input.rent,
      deposit: input.deposit,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function reassignTenant(tenantId: string, newHouseId: string): Promise<void> {
  const { data: tenantRow, error: tenantFetchError } = await supabase
    .from('tenants')
    .select('house_id')
    .eq('id', tenantId)
    .single()
  if (tenantFetchError) throw tenantFetchError

  if (newHouseId !== tenantRow.house_id) {
    const { count, error: countError } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('house_id', newHouseId)
      .eq('status', 'active')
    if (countError) throw countError
    if ((count ?? 0) > 0) throw new Error('That house is already occupied.')
  }

  const { error: tenantError } = await supabase.from('tenants').update({ house_id: newHouseId }).eq('id', tenantId)
  if (tenantError) throw tenantError
}

/** Frees the tenant's house but keeps them active and unassigned — distinct
 * from `vacateTenant`, which ends their stay entirely. */
export async function unassignTenant(tenantId: string): Promise<void> {
  const { error } = await supabase.from('tenants').update({ house_id: null }).eq('id', tenantId)
  if (error) throw error
}

export async function vacateTenant(tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('tenants')
    .update({ status: 'vacated', vacating_date: todayIso(), house_id: null })
    .eq('id', tenantId)
  if (error) throw error
}

export interface CreatePaymentInput {
  tenantId: string
  amount: number
  paymentMode: PaymentMode
  paymentDate: string
  forMonth: string
  notes: string | null
  receiptUrl: string | null
}

export async function createPayment(input: CreatePaymentInput): Promise<void> {
  const { data: tenantRow, error: tenantError } = await supabase
    .from('tenants')
    .select('rent, name, building_id')
    .eq('id', input.tenantId)
    .single()
  if (tenantError) throw tenantError

  const { data: priorPayments, error: priorError } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', input.tenantId)
    .eq('for_month', input.forMonth)
  if (priorError) throw priorError
  const priorTotal = (priorPayments ?? []).reduce((sum, p) => sum + p.amount, 0)
  const status: RentStatus = priorTotal + input.amount >= tenantRow.rent ? 'paid' : 'partial'

  const { error: paymentError } = await supabase.from('payments').insert({
    tenant_id: input.tenantId,
    amount: input.amount,
    payment_mode: input.paymentMode,
    payment_date: input.paymentDate,
    for_month: input.forMonth,
    status,
    notes: input.notes,
    receipt_url: input.receiptUrl,
    // No DB sequence for this yet, so a timestamp-derived tag is the
    // simplest way to give every payment a unique, human-shareable receipt
    // number.
    receipt_number: `RCPT-${Date.now().toString(36).toUpperCase()}`,
  })
  if (paymentError) throw paymentError

  await pushSupabaseNotification(
    tenantRow.building_id,
    'payment',
    'Payment recorded',
    `${formatCurrency(input.amount)} received from ${tenantRow.name}.`,
  )
}

export interface RecordDepositInput {
  tenantId: string
  amount: number
  paidDate: string
  screenshotUrl: string | null
}

export async function recordDeposit(input: RecordDepositInput): Promise<void> {
  const { data: tenantRow, error: tenantError } = await supabase
    .from('tenants')
    .select('name, building_id')
    .eq('id', input.tenantId)
    .single()
  if (tenantError) throw tenantError

  const { error } = await supabase
    .from('tenants')
    .update({
      deposit_paid_amount: input.amount,
      deposit_paid_date: input.paidDate,
      deposit_screenshot_url: input.screenshotUrl,
      deposit_recorded_at: new Date().toISOString(),
    })
    .eq('id', input.tenantId)
  if (error) throw error

  await pushSupabaseNotification(
    tenantRow.building_id,
    'deposit',
    'Deposit recorded',
    `${formatCurrency(input.amount)} deposit recorded for ${tenantRow.name}.`,
  )
}

export async function deleteDeposit(tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('tenants')
    .update({
      deposit_paid_amount: null,
      deposit_paid_date: null,
      deposit_screenshot_url: null,
      deposit_recorded_at: null,
    })
    .eq('id', tenantId)
  if (error) throw error
}

export interface EditPaymentInput {
  id: string
  amount: number
  paymentDate: string
}

export async function updatePayment(input: EditPaymentInput): Promise<void> {
  const { data: paymentRow, error: fetchError } = await supabase
    .from('payments')
    .select('tenant_id, for_month')
    .eq('id', input.id)
    .single()
  if (fetchError) throw fetchError

  const { data: tenantRow, error: tenantError } = await supabase
    .from('tenants')
    .select('rent')
    .eq('id', paymentRow.tenant_id)
    .single()
  if (tenantError) throw tenantError

  const { error: updateError } = await supabase
    .from('payments')
    .update({ amount: input.amount, payment_date: input.paymentDate })
    .eq('id', input.id)
  if (updateError) throw updateError

  const { data: monthPayments, error: monthError } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', paymentRow.tenant_id)
    .eq('for_month', paymentRow.for_month)
  if (monthError) throw monthError

  const total = (monthPayments ?? []).reduce((sum, p) => sum + p.amount, 0)
  const status: RentStatus = total >= tenantRow.rent ? 'paid' : 'partial'

  const { error: statusError } = await supabase.from('payments').update({ status }).eq('id', input.id)
  if (statusError) throw statusError

}

export async function deletePayment(paymentId: string, _tenantId: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) throw error
}

export interface RentIncomeEntry {
  id: string
  tenantId: string
  tenantName: string
  amount: number
  paymentDate: string
  forMonth: string
  createdAt: string
}

/** Every rent payment across all tenants — the "rent collection" side of the
 * income feed, so it shows up alongside other income and expenses. */
export async function getRentIncomeEntries(): Promise<RentIncomeEntry[]> {
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

  const { data: tenantRows, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('building_id', buildingRow.id)
  if (tenantsError) throw tenantsError
  if (tenantRows.length === 0) return []

  const nameById = new Map(tenantRows.map((t) => [t.id, t.name]))
  const { data, error } = await supabase
    .from('payments')
    .select('id, tenant_id, amount, payment_date, for_month, created_at')
    .in('tenant_id', tenantRows.map((t) => t.id))
  if (error) throw error

  return data.map((p) => ({
    id: p.id,
    tenantId: p.tenant_id,
    tenantName: nameById.get(p.tenant_id) ?? 'Tenant',
    amount: p.amount,
    paymentDate: p.payment_date,
    forMonth: p.for_month,
    createdAt: p.created_at,
  }))
}
