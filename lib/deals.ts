import type { Deal, UserStats } from './types';

const DAY_MS = 86_400_000;

/** Late fee: part of a day rounds up, the same rule as the rental price.
 *  The database has the same formula (public.late_fee), so both sides always agree. */
export function lateFee(returnBy: string | Date | null, at: string | Date, perDay: number): number {
  if (!returnBy || perDay <= 0) return 0;
  const due = new Date(returnBy).getTime();
  const now = new Date(at).getTime();
  if (!(now > due)) return 0;
  return Math.ceil((now - due) / DAY_MS) * perDay;
}

/** The fee to show right now: frozen once the item is back, accruing until then. */
export function currentLateFee(deal: Pick<Deal, 'status' | 'return_by' | 'late_fee_per_day' | 'late_fee_final'>, now: Date) {
  if (deal.status === 'completed' && deal.late_fee_final != null) return deal.late_fee_final;
  if (deal.status !== 'agreed') return 0;
  return lateFee(deal.return_by, now, deal.late_fee_per_day);
}

/** A sensible default late fee: one day's share of the rental rate. */
export function suggestedLateFee(rate: number, unitDays: number): number {
  return Math.max(0, Math.ceil(rate / Math.max(1, unitDays)));
}

/** "due in 5h", "due in 2 days", "overdue by 3h", "overdue by 1 day". */
export function dueText(returnBy: string | Date, now: Date): string {
  const diff = new Date(returnBy).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  const span =
    abs >= DAY_MS
      ? `${Math.floor(abs / DAY_MS)} day${Math.floor(abs / DAY_MS) > 1 ? 's' : ''}`
      : hours >= 1
        ? `${hours}h`
        : `${Math.max(1, mins)} min`;
  return diff >= 0 ? `due in ${span}` : `overdue by ${span}`;
}

/** Percent positive, neutrals left out of the ratio but kept in the counts. */
export function reputation(stats: Pick<UserStats, 'positive' | 'neutral' | 'negative' | 'completed'> | null | undefined) {
  const s = stats ?? { positive: 0, neutral: 0, negative: 0, completed: 0 };
  const rated = s.positive + s.negative;
  const percent = rated > 0 ? Math.round((s.positive / rated) * 100) : null;
  const trades = `${s.completed} exchange${s.completed === 1 ? '' : 's'}`;
  const text =
    s.completed === 0 && s.positive + s.neutral + s.negative === 0
      ? 'No exchanges yet'
      : percent === null
        ? trades
        : `${percent}% positive · ${trades}`;
  return { percent, text, ...s };
}
