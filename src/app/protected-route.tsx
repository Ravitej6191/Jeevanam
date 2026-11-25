import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/auth-context'

export function ProtectedRoute() {
  const { isAuthenticated, signedOutByUser } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // An expired session returns to the page you were on after signing in again;
    // a deliberate sign-out starts fresh from the home page.
    return <Navigate to="/login" replace state={signedOutByUser ? undefined : { from: location.pathname + location.search }} />
  }

  return <Outlet />
}
