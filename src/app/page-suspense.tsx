import { Suspense, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/** Shows a spinner while a lazily loaded page's code is fetched. */
export function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}
