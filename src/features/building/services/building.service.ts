import { supabase } from '@/lib/supabase'
import { getCycleStatuses } from '@/features/tenants/services/tenants.service'
import type { RentStatus, TenantRow } from '@/types/database.types'
import type { Tenant } from '@/types/domain'
import type { OccupancyStatus } from '@/constants/status'
import type { BuildingSummary, Floor, House } from '../types'

export interface BuildingData {
  building: BuildingSummary
  floors: Floor[]
}

function deriveHouseFlags(tenant: Tenant | null): {
  occupancyStatus: OccupancyStatus
  hasRentPending: boolean
} {
  return {
    occupancyStatus: tenant ? 'occupied' : 'vacant',
    hasRentPending: tenant?.rentStatus === 'pending',
  }
}

interface AddFloorInput {
  name: string
  floorNumber: number
}

interface AddHouseInput {
  floorId: string
  houseNumber: string
  gasConnectionNumber: string | null
  electricityBillNumber: string | null
}

interface UpdateHouseInput {
  id: string
  houseNumber: string
  gasConnectionNumber: string | null
  electricityBillNumber: string | null
}

// ---- Real Supabase path (scaffolded; not yet exercised until connected) ----

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

async function fetchFromSupabase(): Promise<BuildingData> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (buildingError) throw buildingError
  if (!buildingRow) throw new Error('No building found for this account')

  const { data: settingsRow, error: settingsError } = await supabase
    .from('settings')
    .select('owner_name')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (settingsError) throw settingsError

  const { data: floorRows, error: floorsError } = await supabase
    .from('floors')
    .select('*')
    .eq('building_id', buildingRow.id)
    .order('floor_number', { ascending: true })
  if (floorsError) throw floorsError

  const floorIds = floorRows.map((f) => f.id)
  const { data: houseRows, error: housesError } = await supabase
    .from('houses')
    .select('*')
    .in('floor_id', floorIds)
    .order('house_number', { ascending: true })
  if (housesError) throw housesError

  const houseIds = houseRows.map((h) => h.id)
  const { data: tenantRows, error: tenantsError } = await supabase
    .from('tenants')
    .select('*')
    .in('house_id', houseIds)
    .eq('status', 'active')
  if (tenantsError) throw tenantsError

  const statusById = await getCycleStatuses(tenantRows)
  const houseNumberById = new Map(houseRows.map((h) => [h.id, h.house_number]))
  const floorIdByHouseId = new Map(houseRows.map((h) => [h.id, h.floor_id]))
  const floorNameById = new Map(floorRows.map((f) => [f.id, f.name]))

  const tenantByHouseId = new Map<string, Tenant>()
  for (const row of tenantRows) {
    if (row.house_id === null) continue
    const floorId = floorIdByHouseId.get(row.house_id)
    const houseNumber = houseNumberById.get(row.house_id) ?? ''
    const floorName = (floorId && floorNameById.get(floorId)) || ''
    tenantByHouseId.set(row.house_id, mapTenantRow(row, houseNumber, floorName, statusById.get(row.id) ?? 'pending'))
  }

  const housesByFloorId = new Map<string, House[]>()
  for (const houseRow of houseRows) {
    const tenant = tenantByHouseId.get(houseRow.id) ?? null
    const house: House = {
      id: houseRow.id,
      floorId: houseRow.floor_id,
      houseNumber: houseRow.house_number,
      gasConnectionNumber: houseRow.gas_connection_number,
      electricityBillNumber: houseRow.electricity_bill_number,
      tenant,
      ...deriveHouseFlags(tenant),
    }
    const list = housesByFloorId.get(houseRow.floor_id) ?? []
    list.push(house)
    housesByFloorId.set(houseRow.floor_id, list)
  }

  const floors: Floor[] = floorRows.map((f) => ({
    id: f.id,
    buildingId: f.building_id,
    floorNumber: f.floor_number,
    name: f.name,
    houses: housesByFloorId.get(f.id) ?? [],
  }))

  const building: BuildingSummary = {
    id: buildingRow.id,
    name: buildingRow.name,
    ownerName: settingsRow?.owner_name ?? '',
    propertyType: buildingRow.property_type,
    address: buildingRow.address ?? '',
    city: buildingRow.city ?? '',
    state: buildingRow.state ?? '',
    pincode: buildingRow.pincode ?? '',
    contactPhone: buildingRow.contact_phone ?? '',
    contactEmail: buildingRow.contact_email ?? '',
    totalFloors: floors.length,
    totalHouses: houseRows.length,
  }

  return { building, floors }
}

export async function getBuildingData(): Promise<BuildingData> {
  return fetchFromSupabase()
}

export async function createFloor(input: AddFloorInput): Promise<void> {
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

  const { error } = await supabase
    .from('floors')
    .insert({ building_id: buildingRow.id, floor_number: input.floorNumber, name: input.name })
  if (error) throw error
}

export async function updateFloor(floorId: string, name: string): Promise<void> {
  const { error } = await supabase.from('floors').update({ name }).eq('id', floorId)
  if (error) throw error
}

export async function deleteFloor(floorId: string): Promise<void> {
  const { data: houses, error: housesError } = await supabase.from('houses').select('id').eq('floor_id', floorId)
  if (housesError) throw housesError
  const houseIds = houses.map((h) => h.id)

  if (houseIds.length > 0) {
    const { count, error: tenantsError } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .in('house_id', houseIds)
      .eq('status', 'active')
    if (tenantsError) throw tenantsError
    if ((count ?? 0) > 0) throw new Error('Move or vacate tenants on this floor before deleting it.')
  }

  const { error } = await supabase.from('floors').delete().eq('id', floorId)
  if (error) throw error
}

export async function createHouse(input: AddHouseInput): Promise<void> {
  const { error } = await supabase.from('houses').insert({
    floor_id: input.floorId,
    house_number: input.houseNumber,
    gas_connection_number: input.gasConnectionNumber,
    electricity_bill_number: input.electricityBillNumber,
  })
  if (error) throw error
}

export async function updateHouse(input: UpdateHouseInput): Promise<void> {
  const { error } = await supabase
    .from('houses')
    .update({
      house_number: input.houseNumber,
      gas_connection_number: input.gasConnectionNumber,
      electricity_bill_number: input.electricityBillNumber,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function deleteHouse(houseId: string): Promise<void> {
  const { count, error: tenantsError } = await supabase
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('house_id', houseId)
    .eq('status', 'active')
  if (tenantsError) throw tenantsError
  if ((count ?? 0) > 0) throw new Error('Move or vacate tenants in this house before deleting it.')

  const { error } = await supabase.from('houses').delete().eq('id', houseId)
  if (error) throw error
}
