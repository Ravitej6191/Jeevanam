import { useEffect, useState } from 'react'
import { useRouteError } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RELOAD_FLAG, hasReloaded, reloadOnce } from './lazy-retry'

/** A page's JS file couldn't be fetched — happens when the dev server
 * restarts / re-optimises, or after a new deploy replaces old file names. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(message)
}

/** Root error screen. Stale-file failures are fixed by a reload, which
 * `lazyRetry` already tries once; this is the fallback for anything that
 * still gets through, and for genuine errors. */
export function RouteError() {
  const error = useRouteError()
  const chunkError = isChunkLoadError(error)
  // true while the one automatic reload is still pending
  const [reloading] = useState(() => chunkError && !hasReloaded())

  useEffect(() => {
    if (reloading) {
      reloadOnce()
      return
    }
    if (chunkError) return
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      // ignore
    }
  }, [chunkError, reloading])

  if (reloading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">Something went wrong</p>
        <p className="text-sm text-muted-foreground">Please reload and try again.</p>
      </div>
      <Button
        onClick={() => {
          try {
            sessionStorage.removeItem(RELOAD_FLAG)
          } catch {
            // ignore
          }
          window.location.reload()
        }}
      >
        Reload
      </Button>
    </div>
  )
}
