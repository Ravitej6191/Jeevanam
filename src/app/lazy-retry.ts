import { lazy, type ComponentType } from 'react'

export const RELOAD_FLAG = 'jeevanam.chunkReload'

export function hasReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1'
  } catch {
    return true
  }
}

/** Reloads the page once. Returns false if it already did, so a genuinely
 * broken file can't cause a reload loop. */
export function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}

function clearReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    // ignore
  }
}

// Vite fires this when a preloaded chunk (JS or CSS) 404s after a new deploy.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault()
  })
}

/**
 * `React.lazy` for route pages. When the page's file can't be fetched (the
 * dev server restarted, or a new deploy replaced the old file names) the
 * fix is a reload, so do that once automatically and keep the Suspense
 * spinner showing meanwhile instead of flashing an error screen.
 */
export function lazyRetry<T extends ComponentType>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory()
      clearReloadFlag()
      return mod
    } catch (error) {
      if (reloadOnce()) return new Promise<{ default: T }>(() => {})
      throw error
    }
  })
}
