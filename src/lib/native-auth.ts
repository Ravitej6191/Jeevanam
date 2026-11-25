import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

const CALLBACK_PREFIX = 'com.jeevanam.app://login-callback'

/** Turns the deep link Google/Supabase redirect to into a signed-in session.
 * Supabase's default (implicit) flow puts the tokens after a `#`, the PKCE
 * flow puts a `code` in the query string — both are handled. The resulting
 * session is picked up by auth-provider's onAuthStateChange listener, same as
 * on the web. */
async function completeSignIn(url: string): Promise<void> {
  const parsed = new URL(url)
  const query = parsed.searchParams
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const read = (key: string) => query.get(key) ?? fragment.get(key)

  const errorMessage = read('error_description') ?? read('error')
  if (errorMessage) {
    toast.error(errorMessage.replace(/\+/g, ' '))
    return
  }

  const code = query.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) toast.error(error.message)
    return
  }

  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) toast.error(error.message)
    return
  }

  toast.error('Sign-in did not complete. Please try again.')
}

/** Handles the deep link Google/Supabase redirect to after native sign-in
 * (see android/app/src/main/AndroidManifest.xml's intent-filter and
 * signInWithGoogle's `skipBrowserRedirect` branch). */
export function initNativeAuthListener(): () => void {
  const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith(CALLBACK_PREFIX)) return

    void Browser.close().catch(() => {})
    void completeSignIn(url).catch(() => toast.error('Sign-in did not complete. Please try again.'))
  })

  return () => {
    void listenerPromise.then((listener) => listener.remove())
  }
}
