import { dateOnlyIso } from './format'

/**
 * Indian-style rent cycles: each tenant's rent runs from their agreed date
 * (the day of the month they joined on) to the day before the same date next
 * month — e.g. joined on the 5th → 5th to 4th. Rent is due in advance, on
 * the agreed date itself.
 *
 * A cycle is identified by the month it *starts* in, as `YYYY-MM-01` — the
 * same shape payments already store in `for_month`, so no data migration is
 * needed when the anchor day changes.
 */

function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year: year!, month: month!, day: day ?? 1 }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** The agreed day-of-month (1-31) rent falls due on. */
function agreedDay(joiningDate: string): number {
  return parseIso(joiningDate).day
}

/** Start date of the cycle that begins in the given month — the agreed day,
 * clamped for short months (a 31st anchor starts on the 28th/29th/30th). */
function cycleStart(year: number, month: number, anchorDay: number): Date {
  return new Date(year, month - 1, Math.min(anchorDay, daysInMonth(year, month)))
}

export interface RentCycle {
  /** `YYYY-MM-01` of the month this cycle starts in — the payments `for_month`. */
  forMonth: string
  /** First day of the cycle, `YYYY-MM-DD`. */
  start: string
  /** Last day of the cycle, `YYYY-MM-DD`. */
  end: string
}

/** Describes the cycle that starts in the month of `forMonth`. */
export function cycleFor(joiningDate: string, forMonth: string): RentCycle {
  const anchor = agreedDay(joiningDate)
  const { year, month } = parseIso(forMonth)
  const start = cycleStart(year, month, anchor)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextStart = cycleStart(nextYear, nextMonth, anchor)
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1)
  return { forMonth: monthKeyOf(year, month), start: dateOnlyIso(start), end: dateOnlyIso(end) }
}

/** The cycle `today` falls in for a tenant with the given joining date. Never
 * earlier than the cycle the tenant joined in. */
export function currentCycle(joiningDate: string, today: Date = new Date()): RentCycle {
  const anchor = agreedDay(joiningDate)
  const joined = parseIso(joiningDate)
  let year = today.getFullYear()
  let month = today.getMonth() + 1

  if (today.getDate() < Math.min(anchor, daysInMonth(year, month))) {
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }

  if (year < joined.year || (year === joined.year && month < joined.month)) {
    year = joined.year
    month = joined.month
  }
  return cycleFor(joiningDate, monthKeyOf(year, month))
}
