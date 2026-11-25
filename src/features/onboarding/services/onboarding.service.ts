import { supabase } from '@/lib/supabase'
import type { OnboardingInput } from '../types'

export async function getOnboardingStatus(): Promise<boolean> {
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
    buildingName: 'My Residency',
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
  await upsertProfileToSupabase(input)
}

/** Deletes all of the owner's data (residency, tenants, payments, loans,
 * expenses, income, notifications, uploaded files) but keeps the account and
 * sign-in, via the `clear_app_data` RPC (migration 0009). */
export async function clearAppData(): Promise<void> {
  const { error } = await supabase.rpc('clear_app_data')
  if (error) throw error
}

/** Permanently deletes the owner's account: all cloud data (building, settings
 * and everything cascading from them, plus uploaded files) and the auth user
 * itself, via the `delete_account` RPC (migration 0006). Local data is
 * wiped by the caller. */
export async function clearAccountData(): Promise<void> {
  const { error } = await supabase.rpc('delete_account')
  if (error) throw error
}
