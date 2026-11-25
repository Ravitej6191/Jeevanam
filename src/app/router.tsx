import { Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '@/layouts/app-layout'
import { AuthLayout } from '@/layouts/auth-layout'
import { ProtectedRoute } from './protected-route'
import { BootstrapGate } from './bootstrap-gate'
import { RouteError } from './route-error'
import { lazyRetry } from './lazy-retry'

const LoginPage = lazyRetry(() => import('@/pages/login-page').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazyRetry(() => import('@/pages/dashboard-page').then((m) => ({ default: m.DashboardPage })))
const ResidencyPage = lazyRetry(() => import('@/pages/residency-page').then((m) => ({ default: m.ResidencyPage })))
const LoansPage = lazyRetry(() => import('@/pages/loans-page').then((m) => ({ default: m.LoansPage })))
const LoanDetailPage = lazyRetry(() => import('@/pages/loan-detail-page').then((m) => ({ default: m.LoanDetailPage })))
const RecordLoanRepaymentPage = lazyRetry(() =>
  import('@/pages/record-loan-repayment-page').then((m) => ({ default: m.RecordLoanRepaymentPage })),
)
const TenantsPage = lazyRetry(() => import('@/pages/tenants-page').then((m) => ({ default: m.TenantsPage })))
const TenantDetailPage = lazyRetry(() =>
  import('@/pages/tenant-detail-page').then((m) => ({ default: m.TenantDetailPage })),
)
const AddTenantPage = lazyRetry(() => import('@/pages/add-tenant-page').then((m) => ({ default: m.AddTenantPage })))
const RecordPaymentPage = lazyRetry(() =>
  import('@/pages/record-payment-page').then((m) => ({ default: m.RecordPaymentPage })),
)
const ExpensesPage = lazyRetry(() => import('@/pages/expenses-page').then((m) => ({ default: m.ExpensesPage })))
const BroadcastPage = lazyRetry(() => import('@/pages/broadcast-page').then((m) => ({ default: m.BroadcastPage })))
const SettingsPage = lazyRetry(() => import('@/pages/settings-page').then((m) => ({ default: m.SettingsPage })))
const PastTenantsPage = lazyRetry(() =>
  import('@/pages/past-tenants-page').then((m) => ({ default: m.PastTenantsPage })),
)
const EditProfilePage = lazyRetry(() =>
  import('@/pages/edit-profile-page').then((m) => ({ default: m.EditProfilePage })),
)
const NotificationsPage = lazyRetry(() =>
  import('@/pages/notifications-page').then((m) => ({ default: m.NotificationsPage })),
)
const WhatsAppIntegrationPage = lazyRetry(() =>
  import('@/pages/whatsapp-integration-page').then((m) => ({ default: m.WhatsAppIntegrationPage })),
)
const NotFoundPage = lazyRetry(() => import('@/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })))

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: withSuspense(<LoginPage />) }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <BootstrapGate />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <Navigate to="/dashboard" replace /> },
              { path: '/dashboard', element: withSuspense(<DashboardPage />) },
              { path: '/residency', element: withSuspense(<ResidencyPage />) },
              { path: '/building', element: <Navigate to="/residency" replace /> },
              { path: '/loans', element: withSuspense(<LoansPage />) },
              { path: '/loans/record-repayment', element: withSuspense(<RecordLoanRepaymentPage />) },
              { path: '/loans/:id', element: withSuspense(<LoanDetailPage />) },
              { path: '/tenants', element: withSuspense(<TenantsPage />) },
              { path: '/tenants/new', element: withSuspense(<AddTenantPage />) },
              { path: '/tenants/record-payment', element: withSuspense(<RecordPaymentPage />) },
              { path: '/tenants/:id', element: withSuspense(<TenantDetailPage />) },
              { path: '/tenants/:id/edit', element: withSuspense(<AddTenantPage />) },
              { path: '/expenses', element: withSuspense(<ExpensesPage />) },


              { path: '/broadcast', element: withSuspense(<BroadcastPage />) },
              { path: '/settings', element: withSuspense(<SettingsPage />) },
              { path: '/settings/past-tenants', element: withSuspense(<PastTenantsPage />) },
              { path: '/settings/edit-profile', element: withSuspense(<EditProfilePage />) },
              { path: '/settings/whatsapp', element: withSuspense(<WhatsAppIntegrationPage />) },
              { path: '/notifications', element: withSuspense(<NotificationsPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])
