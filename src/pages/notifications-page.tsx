import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bell, HandCoins, Landmark, ListX, Megaphone, PiggyBank, ReceiptText, TrendingUp, UserPlus, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { ConfirmSheet } from '@/components/common/confirm-sheet'
import { PullToRefresh } from '@/components/common/pull-to-refresh'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { clearAllNotifications, markAllNotificationsRead } from '@/features/notifications/services/notifications.service'
import type { NotificationType } from '@/features/notifications/services/notifications.service'
import { usePageTitle } from '@/hooks/use-page-title'
import { usePageHeaderAction } from '@/hooks/use-page-header-action'

const typeStyles: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  tenant: { icon: UserPlus, className: 'bg-primary/10 text-primary' },
  payment: { icon: Wallet, className: 'bg-success/10 text-success' },
  deposit: { icon: PiggyBank, className: 'bg-info/10 text-info' },
  expense: { icon: ReceiptText, className: 'bg-warning/10 text-warning' },
  income: { icon: TrendingUp, className: 'bg-success/10 text-success' },
  loan: { icon: Landmark, className: 'bg-danger/10 text-danger' },
  loan_repayment: { icon: HandCoins, className: 'bg-info/10 text-info' },
  broadcast: { icon: Megaphone, className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const onBack = useCallback(() => navigate(-1), [navigate])
  usePageTitle('Notifications', onBack)
  const queryClient = useQueryClient()
  const { data: notifications, isLoading, isError, refetch } = useNotifications()
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  useEffect(() => {
    if (notifications && notifications.some((n) => !n.read)) {
      void markAllNotificationsRead().then(() => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications])

  const clearMutation = useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Notifications cleared')
      setClearConfirmOpen(false)
    },
    onError: () => toast.error('Could not clear notifications. Please try again.'),
  })

  usePageHeaderAction(
    notifications && notifications.length > 0 ? (
      <button
        type="button"
        onClick={() => setClearConfirmOpen(true)}
        aria-label="Clear all notifications"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
      >
        <ListX className="size-4" />
      </button>
    ) : null,
  )

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="space-y-4">
        {isError ? (
          <ErrorState title="Couldn't load notifications" description="Please try again." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="Activity such as new tenants, payments, loans, expenses and broadcasts will show up here." />
        ) : (
          <>
            <div className="space-y-2">
              {notifications.map((notification) => {
                const { icon: Icon, className } = typeStyles[notification.type] ?? { icon: Bell, className: 'bg-muted text-muted-foreground' }
                return (
                  <div
                    key={notification.id}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/80 p-3.5"
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${className}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-foreground">{notification.title}</p>
                        {!notification.read ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <ConfirmSheet
          open={clearConfirmOpen}
          onOpenChange={setClearConfirmOpen}
          title="Clear all notifications?"
          description="This can't be undone."
          confirmLabel="Clear All"
          isPending={clearMutation.isPending}
          onConfirm={() => clearMutation.mutate()}
        />
      </div>
    </PullToRefresh>
  )
}
