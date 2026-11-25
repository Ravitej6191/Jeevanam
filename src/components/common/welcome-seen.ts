const WELCOME_SEEN_KEY = 'jeevanam.welcomeSeen'

export function isWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === 'true'
  } catch {
    return false
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, 'true')
  } catch {
    // Storage unavailable — the drawer simply shows again next time.
  }
}
