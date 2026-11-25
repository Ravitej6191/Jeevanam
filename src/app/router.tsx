import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/app-layout'
import { AuthLayout } from '@/layouts/auth-layout'
import { ProtectedRoute } from './protected-route'
import { BootstrapGate } from './bootstrap-gate'
import { RouteError } from './route-error'
import { lazyRetry } from './lazy-retry'
import { PageSuspense } from './page-suspense'

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
const NotFoundPage = lazyRetry(() => import('@/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })))

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <PageSuspense><LoginPage /></PageSuspense> }],
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
              { path: '/dashboard', element: <PageSuspense><DashboardPage /></PageSuspense> },
              { path: '/residency', element: <PageSuspense><ResidencyPage /></PageSuspense> },
              { path: '/building', element: <Navigate to="/residency" replace /> },
              { path: '/loans', element: <PageSuspense><LoansPage /></PageSuspense> },
              { path: '/loans/record-repayment', element: <PageSuspense><RecordLoanRepaymentPage /></PageSuspense> },
              { path: '/loans/:id', element: <PageSuspense><LoanDetailPage /></PageSuspense> },
              { path: '/tenants', element: <PageSuspense><TenantsPage /></PageSuspense> },
              { path: '/tenants/new', element: <PageSuspense><AddTenantPage /></PageSuspense> },
              { path: '/tenants/record-payment', element: <PageSuspense><RecordPaymentPage /></PageSuspense> },
              { path: '/tenants/:id', element: <PageSuspense><TenantDetailPage /></PageSuspense> },
              { path: '/tenants/:id/edit', element: <PageSuspense><AddTenantPage /></PageSuspense> },
              { path: '/expenses', element: <PageSuspense><ExpensesPage /></PageSuspense> },


              { path: '/broadcast', element: <PageSuspense><BroadcastPage /></PageSuspense> },
              { path: '/settings', element: <PageSuspense><SettingsPage /></PageSuspense> },
              { path: '/settings/past-tenants', element: <PageSuspense><PastTenantsPage /></PageSuspense> },
              { path: '/settings/edit-profile', element: <PageSuspense><EditProfilePage /></PageSuspense> },
              { path: '/notifications', element: <PageSuspense><NotificationsPage /></PageSuspense> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <PageSuspense><NotFoundPage /></PageSuspense> },
    ],
  },
])
