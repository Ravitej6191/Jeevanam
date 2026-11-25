import { Capacitor, registerPlugin } from '@capacitor/core'

interface JeevanamSmsPlugin {
  send(options: { to: string; message: string }): Promise<{ ok: boolean; error?: string }>
  status(): Promise<{ supported: boolean; simReady: boolean }>
  checkPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' }>
  requestPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' }>
}

/** Native Android plugin (plugins/jeevanam-sms) that sends an SMS directly. */
const JeevanamSms = registerPlugin<JeevanamSmsPlugin>('JeevanamSms')

/** Sending SMS needs the Android app — a browser has no SIM to send from. */
export function canSendSms(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/** A 10-digit Indian mobile becomes +91…; anything else is passed through. */
export function toSmsNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 && /^[6-9]/.test(digits) ? `+91${digits}` : digits.length > 10 ? `+${digits}` : digits
}

/** Shows Android's "allow SMS?" prompt (nothing happens if it's already allowed). */
export async function requestSmsPermission(): Promise<boolean> {
  try {
    const current = await JeevanamSms.checkPermissions()
    if (current.sms === 'granted') return true
    return (await JeevanamSms.requestPermissions()).sms === 'granted'
  } catch {
    return false
  }
}

export type SmsResult = { ok: true } | { ok: false; error: string; permissionDenied?: boolean }

/** Whether this phone can send SMS right now (has telephony and a ready SIM). */
export async function smsAvailability(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supported, simReady } = await JeevanamSms.status()
    if (!supported) return { ok: false, error: 'This device cannot send SMS.' }
    if (!simReady) return { ok: false, error: 'No SIM card is ready. Insert a SIM and try again.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'SMS is not available on this device.' }
  }
}

/** Sends one SMS and resolves once the phone reports whether it went out. */
export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  try {
    const result = await JeevanamSms.send({ to: toSmsNumber(phone), message })
    return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'The phone could not send it.' }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === 'PERMISSION_DENIED') {
      return { ok: false, error: 'SMS permission is off.', permissionDenied: true }
    }
    return { ok: false, error: 'The phone could not send it.' }
  }
}
