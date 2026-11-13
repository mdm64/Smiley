/** Rental maths, carried over from the prototype's core.js unchanged in behaviour.
 *  Pickup day counts, return day does not. Partial periods round up. */

export type Unit = 'day' | 'week' | 'month' | 'semester';

export const UNIT_DAYS: Record<Unit, number> = { day: 1, week: 7, month: 30, semester: 120 };

export type Quote = { days: number; units: number; fee: number; deposit: number; total: number };

export function rentalQuote(
  rate: number,
  unit: Unit,
  start: string,
  end: string,
  deposit = 0,
): Quote {
  const a = Date.parse(start + 'T00:00:00Z');
  const b = Date.parse(end + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) {
    throw new Error('Choose a return date after the pickup date.');
  }
  const divisor = UNIT_DAYS[unit];
  if (!divisor || rate <= 0 || deposit < 0) throw new Error('Invalid rental terms.');
  const days = (b - a) / 86_400_000;
  const units = Math.ceil(days / divisor);
  const fee = units * rate;
  return { days, units, fee, deposit, total: fee + deposit };
}

/** Half-open ranges: a same-day handover is not an overlap. */
export const overlaps = (a: string, b: string, c: string, d: string) => a < d && c < b;
