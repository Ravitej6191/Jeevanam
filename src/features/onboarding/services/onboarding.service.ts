import { isDemoSession } from '@/config/env'
import { supabase } from '@/lib/supabase'
import { getDemoDb, seedFromOnboarding, updateBuildingProfile } from '@/lib/demo-store'
import type { OnboardingInput } from '../types'

export async function getOnboardingStatus(): Promise<boolean> {
  if (isDemoSession()) {
    return getDemoDb().settings.onboardingCompleted
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('settings')
    .select('onboarding_completed')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (error) throw error

  return data?.onboarding_completed ?? false
}

async function upsertProfileToSupabase(input: OnboardingInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error: buildingError } = await supabase.from('building').upsert(
    {
      owner_id: user.id,
      name: input.buildingName,
      property_type: input.propertyType,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      contact_phone: input.phone,
      contact_email: input.email,
    },
    { onConflict: 'owner_id' },
  )
  if (buildingError) throw buildingError

  const { error: settingsError } = await supabase.from('settings').upsert(
    {
      owner_id: user.id,
      owner_name: input.ownerName,
      onboarding_completed: true,
    },
    { onConflict: 'owner_id' },
  )
  if (settingsError) throw settingsError
}

async function completeOnboarding(input: OnboardingInput): Promise<void> {
  if (isDemoSession()) {
    seedFromOnboarding(input)
    return
  }
  await upsertProfileToSupabase(input)
}

/** Silently provisions the default building/settings row on first sign-in
 * (building name is the only column the DB requires). Owner name, email and
 * phone are seeded from the signed-in account — for Google that's the
 * profile Google shares — and everything else can be filled in later from
 * Settings. */
export async function skipOnboarding(profile: { ownerName?: string; email?: string; phone?: string } = {}): Promise<void> {
  await completeOnboarding({
    propertyType: 'pg',
    buildingName: 'My Property',
    address: '',
    city: '',
    state: '',
    pincode: '',
    ownerName: profile.ownerName ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
  })
}

/** Updates building/owner profile fields without touching the existing
 * floors/houses/tenants — used by the Settings "edit profile" flow. */
export async function updateProfile(input: OnboardingInput): Promise<void> {
  if (isDemoSession()) {
    updateBuildingProfile({
      name: input.buildingName,
      propertyType: input.propertyType,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      contactPhone: input.phone,
      contactEmail: input.email,
      ownerName: input.ownerName,
    })
    return
  }
  await upsertProfileToSupabase(input)
}

/** Permanently deletes the owner's account: all cloud data (building, settings
 * and everything cascading from them, plus uploaded files) and the auth user
 * itself, via the `delete_account` RPC (migration 0006). Demo mode has no
 * cloud, so there's nothing to delete remotely — local data is wiped by the
 * caller either way. */
export async function clearAccountData(): Promise<void> {
  if (isDemoSession()) return

  const { error } = await supabase.rpc('delete_account')
  if (error) throw error
}
