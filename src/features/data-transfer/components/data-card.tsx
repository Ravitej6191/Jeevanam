import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Download, Loader2, ShieldAlert, Trash2, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmSheet } from '@/components/common/confirm-sheet'
import { clearAccountData, clearAppData } from '@/features/onboarding/services/onboarding.service'
import { useAuth } from '@/providers/auth-context'
import { wipeLocalDataAndRestart } from '@/lib/local-data'
import { todayIso } from '@/utils/format'
import {
  BackupError,
  backupToXlsx,
  exportBackup,
  importBackup,
  readBackupFile,
  summarizeBackup,
  type Backup,
} from '../services/data-transfer.service'

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

interface RowProps {
  icon: ReactNode
  iconClassName: string
  label: string
  labelClassName?: string
  onClick: () => void
  busy?: boolean
}

function ActionRow({ icon, iconClassName, label, labelClassName = 'text-foreground', onClick, busy }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-2.5 py-3 text-left disabled:opacity-60"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>{icon}</span>
      <span className={`flex-1 text-sm font-medium ${labelClassName}`}>{label}</span>
      {busy ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <ChevronRight className="size-4 text-muted-foreground" />
      )}
    </button>
  )
}

/** Settings card for moving data in and out, plus the destructive actions. */
export function DataCard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<Backup | null>(null)
  const [clearDataOpen, setClearDataOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)

  const exportMutation = useMutation({
    mutationFn: async () => backupToXlsx(await exportBackup()),
    onSuccess: (blob) => {
      downloadBlob(`jeevanam-export-${todayIso()}.xlsx`, blob)
      toast.success('Excel file downloaded')
    },
    onError: () => toast.error('Could not export your data. Please try again.'),
  })

  const importMutation = useMutation({
    mutationFn: importBackup,
    onSuccess: async () => {
      setPendingImport(null)
      await queryClient.invalidateQueries()
      toast.success('Data imported')
    },
    onError: (error) => {
      setPendingImport(null)
      toast.error(error instanceof BackupError ? error.message : 'Could not import that file. Please try again.')
    },
  })

  // Reset deletes all the owner's data but keeps the account and sign-in, so
  // they land back on an empty dashboard.
  const resetDataMutation = useMutation({
    mutationFn: clearAppData,
    onSuccess: () => {
      queryClient.clear()
      setClearDataOpen(false)
      toast.success('All data deleted')
      navigate('/dashboard', { replace: true })
    },
    onError: () => toast.error('Could not delete your data. Please try again.'),
  })

  // Delete removes the cloud account first; if that fails nothing local is
  // touched.
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await clearAccountData()
      await logout().catch(() => undefined)
    },
    onSuccess: () => wipeLocalDataAndRestart(),
    onError: () => toast.error('Could not delete your account. Please try again.'),
  })

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPendingImport(await readBackupFile(file))
    } catch (error) {
      toast.error(error instanceof BackupError ? error.message : 'Could not read that file.')
    }
  }

  const summary = pendingImport ? summarizeBackup(pendingImport) : null

  return (
    <>
      <Card className="border-border">
        <CardContent className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Data</p>

          <div className="-my-1 divide-y divide-border">
            <ActionRow
              icon={<Download className="size-4" />}
              iconClassName="bg-muted text-muted-foreground"
              label="Export Data"
              busy={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            />
            <ActionRow
              icon={<Upload className="size-4" />}
              iconClassName="bg-muted text-muted-foreground"
              label="Import Data"
              busy={importMutation.isPending}
              onClick={() => fileInput.current?.click()}
            />
            <ActionRow
              icon={<Users className="size-4" />}
              iconClassName="bg-muted text-muted-foreground"
              label="Past Tenants"
              onClick={() => navigate('/settings/past-tenants')}
            />
            <ActionRow
              icon={<Trash2 className="size-4" />}
              iconClassName="bg-warning/10 text-warning"
              label="Reset App Data"
              onClick={() => setClearDataOpen(true)}
            />
            <ActionRow
              icon={<ShieldAlert className="size-4" />}
              iconClassName="bg-danger/10 text-danger"
              label="Delete Account"
              labelClassName="text-danger"
              onClick={() => setDeleteAccountOpen(true)}
            />
          </div>
        </CardContent>
      </Card>

      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <ConfirmSheet
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null)
        }}
        title="Import this file?"
        description={
          summary
            ? `This adds ${plural(summary.tenants, 'tenant')}, ${plural(summary.payments, 'payment')}, ${plural(summary.loans, 'loan')}, ${plural(summary.expenses, 'expense')} and ${summary.incomes} income ${summary.incomes === 1 ? 'entry' : 'entries'} to your account. Import only works on an empty account.`
            : ''
        }
        confirmLabel="Import"
        destructive={false}
        isPending={importMutation.isPending}
        onConfirm={() => pendingImport && importMutation.mutate(pendingImport)}
      />

      <ConfirmSheet
        open={clearDataOpen}
        onOpenChange={setClearDataOpen}
        title="Delete all your data?"
        description="This permanently deletes your residency, tenants, payments, loans, expenses, income and uploaded photos. Your account and sign-in are kept. This can't be undone."
        confirmLabel="Delete Data"
        isPending={resetDataMutation.isPending}
        onConfirm={() => resetDataMutation.mutate()}
      />

      <ConfirmSheet
        open={deleteAccountOpen}
        onOpenChange={setDeleteAccountOpen}
        title="Delete your account?"
        description="This permanently deletes your account and all your data — residency, tenants, payments, expenses, uploaded photos — from the cloud and this device, and signs you out. This can't be undone."
        confirmLabel="Delete Account"
        isPending={deleteAccountMutation.isPending}
        onConfirm={() => deleteAccountMutation.mutate()}
      />
    </>
  )
}
