import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { signOut as signOutSupabase } from '@/features/auth/services/auth.service'
import { useAppLockStore } from '@/store/app-lock-store'
import type { AuthUser } from '@/features/auth/types'
import { AuthContext, type AuthContextValue } from './auth-context'

function mapSupabaseUser(user: {
  id: string
  email?: string
  phone?: string
  user_metadata: Record<string, unknown>
}): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata.name as string | undefined) ?? (user.user_metadata.full_name as string | undefined) ?? user.email ?? 'Owner',
    photoUrl: (user.user_metadata.avatar_url as string | undefined) ?? (user.user_metadata.picture as string | undefined) ?? null,
    // Google's OAuth scopes don't include phone number by default, so this is
    // usually null — falls back to Supabase's own verified `phone` (used when
    // phone-based auth is set up) or a phone_number claim if ever present.
    phone: user.phone || (user.user_metadata.phone_number as string | undefined) || null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [signedOutByUser, setSignedOutByUser] = useState(false)

  useEffect(() => {
    // Deliberately not calling getSession() up front — after an OAuth
    // redirect, the session isn't established yet (Supabase is still
    // exchanging the ?code=... in the URL for a real session), so a
    // getSession() call here can resolve with "no session" before that
    // finishes, incorrectly bouncing a successful sign-in back to /login.
    // onAuthStateChange's first callback is always 'INITIAL_SESSION',
    // fired only once that exchange (if any) has completed, so this is the
    // one call that's actually safe to gate isLoading on.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null)
      if (session?.user) setSignedOutByUser(false)
      setIsLoading(false)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const logout = useCallback(async () => {
    // App Lock is tied to "this device, this session" — carrying a stale PIN
    // into the next login (a different Google account) makes no
    // sense, so clear it on the way out. The next signed-in user can turn it
    // back on from Settings if they want it.
    useAppLockStore.getState().disable()
    setSignedOutByUser(true)

    await signOutSupabase()
    queryClient.clear()
    setUser(null)
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      signedOutByUser,
      logout,
    }),
    [user, isLoading, signedOutByUser, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
