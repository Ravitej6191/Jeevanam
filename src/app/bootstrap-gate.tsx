import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useOnboardingStatus } from '@/features/onboarding/hooks/use-onboarding-status'
import { useAuth } from '@/providers/auth-provider'
import { skipOnboarding } from '@/features/onboarding/services/onboarding.service'

/**
 * There's no user-facing onboarding form — a first-time sign-in silently
 * provisions a default building/settings row (the same minimal shape the
 * old "Skip for now" button always wrote) so every downstream query that
 * assumes a building already exists (tenants, expenses, loans, dashboard,
 * ...) keeps working. Renders nothing but a spinner until that's done, so
 * children never see a "no building found" error on first load.
 */
export function BootstrapGate() {
  const queryClient = useQueryClient()
  const { user, isDemoMode } = useAuth()
  const { data: isProvisioned, isLoading } = useOnboardingStatus()

  useEffect(() => {
    if (isLoading || isProvisioned) return
    // Demo user is a placeholder identity — don't copy it into the profile.
    const profile = isDemoMode ? {} : { ownerName: user?.name, email: user?.email, phone: user?.phone ?? undefined }
    void skipOnboarding(profile).then(() => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] })
    })
  }, [isLoading, isProvisioned, queryClient, user, isDemoMode])

  if (isLoading || !isProvisioned) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <Outlet />
}
