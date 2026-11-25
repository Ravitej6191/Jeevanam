import { THEME_COLOR_KEY } from '@/constants/theme-colors'

// Appearance is a device preference, not app data — wiping it would flip the
// login screen back to the OS default (often dark) right after a reset.
// next-themes stores the light/dark choice under "theme".
const PRESERVED_KEYS = ['theme', THEME_COLOR_KEY]

/**
 * Wipes everything this app has stored on the device — App Lock PIN/biometrics, welcome-seen flag, and any cached auth session —
 * but keeps the appearance preferences, then does a hard reload to the login
 * screen so no in-memory state (React Query cache, stores) survives either.
 * Cloud data is untouched; deleting that is `clearAccountData`'s job.
 */
export function wipeLocalDataAndRestart(): void {
  try {
    const kept = PRESERVED_KEYS.flatMap((key) => {
      const value = localStorage.getItem(key)
      return value === null ? [] : [[key, value] as const]
    })
    localStorage.clear()
    sessionStorage.clear()
    for (const [key, value] of kept) localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode / blocked) — nothing to wipe.
  }
  window.location.replace('/login')
}
