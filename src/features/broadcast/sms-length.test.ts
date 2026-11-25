import { describe, expect, it } from 'vitest'
import { smsInfo } from './sms-length'

describe('SMS length', () => {
  it('is zero parts for an empty message', () => {
    expect(smsInfo('')).toEqual({ length: 0, parts: 0, unicode: false })
  })

  it('fits 160 English characters in one SMS and splits after that', () => {
    expect(smsInfo('a'.repeat(160))).toMatchObject({ parts: 1, unicode: false })
    expect(smsInfo('a'.repeat(161))).toMatchObject({ parts: 2, unicode: false })
    expect(smsInfo('a'.repeat(306))).toMatchObject({ parts: 2 })
    expect(smsInfo('a'.repeat(307))).toMatchObject({ parts: 3 })
  })

  it('counts a few special characters double', () => {
    expect(smsInfo('{'.repeat(80))).toMatchObject({ parts: 1 })
    expect(smsInfo('{'.repeat(81))).toMatchObject({ parts: 2 })
  })

  it('switches to the shorter Unicode limit for Telugu', () => {
    const telugu = 'అద్దె'.repeat(14) // 70 characters
    expect(smsInfo(telugu)).toMatchObject({ length: 70, parts: 1, unicode: true })
    expect(smsInfo(telugu + 'అ')).toMatchObject({ parts: 2, unicode: true })
  })

  it('treats one non-standard character as Unicode for the whole message', () => {
    expect(smsInfo('Rent due ₹5000')).toMatchObject({ unicode: true })
    expect(smsInfo('Rent due Rs 5000')).toMatchObject({ unicode: false })
  })
})
