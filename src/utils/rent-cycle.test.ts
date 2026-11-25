import { describe, expect, it } from 'vitest'
import { currentCycle, cycleFor } from './rent-cycle'

describe('rent cycles (agreed date)', () => {
  it('runs from the agreed day to the day before the same day next month', () => {
    expect(cycleFor('2026-01-05', '2026-11-01')).toEqual({ forMonth: '2026-11-01', start: '2026-11-05', end: '2026-12-04' })
  })

  it('stays in the previous cycle until the agreed day arrives', () => {
    expect(currentCycle('2026-01-05', new Date(2026, 10, 4)).forMonth).toBe('2026-10-01')
    expect(currentCycle('2026-01-05', new Date(2026, 10, 5)).forMonth).toBe('2026-11-01')
  })

  it('rolls back across a year boundary', () => {
    expect(currentCycle('2025-01-20', new Date(2026, 0, 3)).forMonth).toBe('2025-12-01')
  })

  it('clamps a 31st anchor to short months', () => {
    expect(cycleFor('2026-01-31', '2026-02-01')).toEqual({ forMonth: '2026-02-01', start: '2026-02-28', end: '2026-03-30' })
    expect(currentCycle('2026-01-31', new Date(2026, 1, 28)).forMonth).toBe('2026-02-01')
  })

  it('never reports a cycle before the one the tenant joined in', () => {
    expect(currentCycle('2026-11-20', new Date(2026, 10, 10)).forMonth).toBe('2026-11-01')
  })
})
