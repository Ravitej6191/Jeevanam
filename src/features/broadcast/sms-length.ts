// Characters an SMS can carry in the standard 7-bit alphabet. Anything outside
// it (Telugu, Hindi, emoji, curly quotes…) switches the whole message to
// Unicode, which fits far fewer characters per SMS.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
// Each of these takes two character slots.
const GSM_EXTENDED = '^{}\\[~]|€'

export interface SmsInfo {
  /** Characters typed. */
  length: number
  /** How many SMS the message is split into (0 for an empty message). */
  parts: number
  /** True when the message needs the shorter Unicode limit. */
  unicode: boolean
}

export function smsInfo(text: string): SmsInfo {
  if (text.length === 0) return { length: 0, parts: 0, unicode: false }

  let slots = 0
  let gsm = true
  for (const char of text) {
    if (GSM_BASIC.includes(char)) slots += 1
    else if (GSM_EXTENDED.includes(char)) slots += 2
    else {
      gsm = false
      break
    }
  }

  if (gsm) return { length: text.length, parts: slots <= 160 ? 1 : Math.ceil(slots / 153), unicode: false }
  return { length: text.length, parts: text.length <= 70 ? 1 : Math.ceil(text.length / 67), unicode: true }
}
