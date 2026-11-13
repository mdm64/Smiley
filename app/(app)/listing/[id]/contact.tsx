'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { openConversation, sendMessage } from '@/app/(app)/actions';
import { rentalQuote, type Unit } from '@/lib/rental';
import { rupees } from '@/lib/format';
import type { Mode } from '@/lib/types';

const today = () => new Date().toLocaleDateString('en-CA');

export default function ContactPanel({
  listingId,
  existingConversation,
  canRent,
  canBuy,
  mode,
  rate,
  unit,
  deposit,
  price,
  title,
}: {
  listingId: string;
  existingConversation: string | null;
  canRent: boolean;
  canBuy: boolean;
  mode: Mode;
  rate: number;
  unit: Unit;
  deposit: number;
  price: number;
  title: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [start_, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  const quote = useMemo(() => {
    if (!start_ || !end) return null;
    try {
      return rentalQuote(rate, unit, start_, end, deposit);
    } catch {
      return null;
    }
  }, [start_, end, rate, unit, deposit]);

  const dateProblem = start_ && end && !quote ? 'Pick a return date after the pickup date.' : null;

  const go = (body: string, offer?: number) =>
    start(async () => {
      setError(null);
      const id = existingConversation ?? (await openConversation(listingId));
      if (!id) {
        setError('That conversation could not be opened. Reload and try again.');
        return;
      }
      await sendMessage(id, body, offer);
      router.push(`/chats/${id}`);
    });

  return (
    <div className="stack">
      {canRent && (
        <div className="panel">
          <h3 style={{ marginBottom: 2 }}>Rent it for a few days</h3>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Pickup day counts, return day does not. Part of a {unit} rounds up.
          </p>

          <div className="row2">
            <label className="field">
              <span>Pickup</span>
              <input type="date" min={today()} value={start_} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field">
              <span>Return</span>
              <input
                type="date"
                min={start_ || today()}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>

          {dateProblem && <p className="error" style={{ marginTop: 0 }}>{dateProblem}</p>}

          {quote && (
            <dl className="spec" style={{ marginBottom: 14 }}>
              <div>
                <dt>
                  {quote.units} {unit}
                  {quote.units > 1 ? 's' : ''} at {rupees(rate)}
                </dt>
              </div>
              <div>
                <dd className="tnum">{rupees(quote.fee)}</dd>
              </div>
              <div>
                <dt>Deposit, refundable</dt>
              </div>
              <div>
                <dd className="tnum">{rupees(quote.deposit)}</dd>
              </div>
              <div>
                <dt>
                  <strong>You hand over</strong>
                </dt>
              </div>
              <div>
                <dd className="tnum">
                  <strong>{rupees(quote.total)}</strong>
                </dd>
              </div>
            </dl>
          )}

          <button
            className="btn primary wide"
            disabled={!quote || pending}
            onClick={() =>
              quote &&
              go(
                `Could I rent this from ${start_} to ${end}? That is ${quote.units} ${unit}${
                  quote.units > 1 ? 's' : ''
                } — ${rupees(quote.fee)} plus ${rupees(quote.deposit)} deposit, ${rupees(
                  quote.total,
                )} in total.`,
                quote.fee,
              )
            }
          >
            {pending ? 'Opening chat…' : 'Ask about these dates'}
          </button>
        </div>
      )}

      {canBuy && (
        <button
          className={`btn wide${canRent ? '' : ' primary'}`}
          disabled={pending}
          onClick={() =>
            go(
              mode === 'free'
                ? `Is ${title} still going? I could collect it this week.`
                : `Is ${title} still available at ${rupees(price)}?`,
            )
          }
        >
          {pending ? 'Opening chat…' : mode === 'free' ? 'Ask for this item' : 'Message the seller'}
        </button>
      )}

      {existingConversation && (
        <button className="btn quiet" onClick={() => router.push(`/chats/${existingConversation}`)}>
          You already have a chat about this — open it
        </button>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
