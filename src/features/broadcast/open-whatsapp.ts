import { AppLauncher } from '@capacitor/app-launcher'
import { Browser } from '@capacitor/browser'

/** Full international digits for WhatsApp: a 10-digit Indian mobile gets 91. */
function whatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 && /^[6-9]/.test(digits) ? `91${digits}` : digits
}

/**
 * Opens WhatsApp on the phone with a chat to `phone` and `text` already typed
 * in — the owner just taps send. Falls back to the wa.me web link when the
 * WhatsApp app can't be opened directly.
 */
export async function openWhatsAppChat(phone: string, text: string): Promise<void> {
  const number = whatsAppNumber(phone)
  const query = encodeURIComponent(text)
  try {
    await AppLauncher.openUrl({ url: `whatsapp://send?phone=${number}&text=${query}` })
  } catch {
    await Browser.open({ url: `https://wa.me/${number}?text=${query}` })
  }
}
