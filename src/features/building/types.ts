import type { PropertyType } from '@/types/database.types'
import type { Tenant } from '@/types/domain'
import type { OccupancyStatus } from '@/constants/status'

export interface House {
  id: string
  floorId: string
  houseNumber: string
  gasConnectionNumber: string | null
  electricityBillNumber: string | null
  /** A house holds at most one active tenant. */
  tenant: Tenant | null
  occupancyStatus: OccupancyStatus
  hasRentPending: boolean
}

export interface Floor {
  id: string
  buildingId: string
  floorNumber: number
  name: string
  houses: House[]
}

export interface BuildingSummary {
  id: string
  name: string
  ownerName: string
  propertyType: PropertyType
  address: string
  city: string
  state: string
  pincode: string
  contactPhone: string
  contactEmail: string
  totalFloors: number
  totalHouses: number
}
