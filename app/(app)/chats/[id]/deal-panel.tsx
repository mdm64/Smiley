'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordDeal, confirmHandover, markReturned, cancelDeal, leaveFeedback } from '@/app/(app)/deals/actions';
import { rupees } from '@/lib/format';
import { currentLateFee, dueText, suggestedLateFee } from '@/lib/deals';
import { UNIT_DAYS } from '@/lib/rental';
import type { Deal, DealKind, Grade, Listing, Review } from '@/lib/types';

const GRADES: { key: Grade; label: string; note: string }[] = [
  { key: 'positive', label: 'Positive', note: 'It went well' },
  { key: 'neutral', label: 'Okay', note: 'Fine, nothing special' },
  { key: 'negative', label: 'Negative', note: 'Something went wrong' },
];
const GRADE_LABEL: Record<Grade, string> = { positive: 'Positive', neutral: 'Okay', negative: 'Negative' };

/** Tomorrow, 6 pm, in the shape a datetime-local input wants. */
function defaultReturn() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function DealPanel({
  conversationId,
  meId,
  isSeller,
  listing,
  openDeal,
  latestDone,
  phone,
  myReview,
  theirReview,
  hasAnyDeal,
}: {
  conversationId: string;
  meId: string;
  isSeller: boolean;
  listing: Listing | null;
  openDeal: Deal | null;
  latestDone: Deal | null;
  phone: string | null;
  myReview: Review | null;
  theirReview: Review | null;
  hasAnyDeal: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keeps "due in 5h" honest without a reload.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });

  // ---- recording a deal -------------------------------------------------
  const kinds: DealKind[] = !listing
    ? []
    : listing.mode === 'sell'
      ? ['sale']
      : listing.mode === 'rent'
        ? ['rental']
        : listing.mode === 'both'
          ? ['sale', 'rental']
          : ['free'];

  const [recording, setRecording] = useState(false);
  const [kind, setKind] = useState<DealKind>(kinds[0] ?? 'sale');
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [returnBy, setReturnBy] = useState('');
  const [lateFee, setLateFee] = useState('');

  const startRecording = () => {
    if (!listing) return;
    const k = kinds[0];
    setKind(k);
    setAmount(String(k === 'rental' ? listing.rate : listing.price));
    setDeposit(String(listing.deposit || 0));
    setReturnBy(defaultReturn());
    setLateFee(String(suggestedLateFee(listing.rate, UNIT_DAYS[listing.unit])));
    setError(null);
    setRecording(true);
  };

  const pickKind = (k: DealKind) => {
    setKind(k);
    if (listing) setAmount(String(k === 'rental' ? listing.rate : listing.price));
  };

  const submitDeal = () =>
    run(async () => {
      const res = await recordDeal({
        conversationId,
        kind,
        amount: Number(amount),
        deposit: Number(deposit),
        returnBy: kind === 'rental' ? returnBy : undefined,
        lateFee: Number(lateFee),
      });
      if (!res.error) setRecording(false);
      return res;
    });

  // ---- feedback ---------------------------------------------------------
  const [grade, setGrade] = useState<Grade | null>(null);
  const [comment, setComment] = useState('');

  const sendFeedback = () => {
    if (!latestDone || !grade) return setError('Choose how it went.');
    run(() => leaveFeedback(latestDone.id, conversationId, grade, comment));
  };

  const money = (
    <p className="small muted" style={{ margin: '10px 0 0' }}>
      Pay each other directly. ReLoop never holds money or deposits.
    </p>
  );

  const phoneLine = phone ? (
    <p className="small" style={{ margin: '8px 0 0' }}>
      Their number: <a href={`tel:${phone}`}>{phone}</a>
    </p>
  ) : (
    <p className="small muted" style={{ margin: '8px 0 0' }}>
      Phone numbers stay private. If they have added one, it appears here once you have a deal.
    </p>
  );

  // ---- an open deal -----------------------------------------------------
  if (openDeal) {
    const d = openDeal;
    const iAmSeller = d.seller_id === meId;
    const myConfirmed = iAmSeller ? d.seller_confirmed_at : d.buyer_confirmed_at;
    const theirConfirmed = iAmSeller ? d.buyer_confirmed_at : d.seller_confirmed_at;
    const fee = currentLateFee(d, now);
    const overdue = d.kind === 'rental' && d.return_by && new Date(d.return_by) < now;

    return (
      <div className="dealbar">
        <div className="dealbar-head">
          <b>
            {d.kind === 'rental'
              ? 'Rental in progress'
              : d.kind === 'free'
                ? 'Handover in progress'
                : `Deal: ${rupees(d.amount)}`}
          </b>
          <span className={`chip ${overdue ? 'sale' : 'rent'}`}>
            {d.kind === 'rental' && d.return_by ? dueText(d.return_by, now) : 'Agreed'}
          </span>
        </div>

        {d.kind === 'rental' ? (
          <dl className="mini">
            <div><dt>Rent</dt><dd className="tnum">{rupees(d.amount)}</dd></div>
            <div><dt>Deposit, refundable</dt><dd className="tnum">{rupees(d.deposit)}</dd></div>
            <div><dt>Due back</dt><dd>{d.return_by && when(d.return_by)}</dd></div>
            <div><dt>Late fee</dt><dd className="tnum">{rupees(d.late_fee_per_day)} per day</dd></div>
            {fee > 0 && (
              <div className="due-now">
                <dt>Late fee so far</dt>
                <dd className="tnum">{rupees(fee)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            {myConfirmed
              ? 'You confirmed the handover. Waiting for the other side.'
              : theirConfirmed
                ? 'They have confirmed. Your turn once you have it in hand.'
                : 'Both of you confirm once the item has changed hands.'}
          </p>
        )}

        <div className="dealbar-actions">
          {d.kind === 'rental' ? (
            iAmSeller ? (
              <button className="btn primary" disabled={pending} onClick={() => run(() => markReturned(d.id, conversationId))}>
                Item returned
              </button>
            ) : (
              <span className="small muted">The owner marks it returned when it is back with them.</span>
            )
          ) : (
            !myConfirmed && (
              <button className="btn primary" disabled={pending} onClick={() => run(() => confirmHandover(d.id, conversationId))}>
                {iAmSeller ? 'I have handed it over' : 'I have received it'}
              </button>
            )
          )}
          <button
            className="btn quiet"
            disabled={pending}
            onClick={() => {
              if (confirm('Cancel this deal?')) run(() => cancelDeal(d.id, conversationId));
            }}
          >
            Cancel deal
          </button>
        </div>

        {d.kind === 'rental' && (
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            An automatic reminder goes out in this chat 6 hours before it is due.
          </p>
        )}
        {phoneLine}
        {money}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // ---- finished deal: feedback -----------------------------------------
  const showFeedback = latestDone && (!myReview || !recording);
  const feedback =
    latestDone && showFeedback ? (
      <div className="dealbar">
        <div className="dealbar-head">
          <b>{latestDone.kind === 'rental' ? 'Rental complete' : 'Deal complete'}</b>
          <span className="chip rent">Done</span>
        </div>

        {latestDone.kind === 'rental' && (latestDone.late_fee_final ?? 0) > 0 && (
          <p className="small" style={{ margin: '6px 0 0' }}>
            Returned late. Late fee: <b className="tnum">{rupees(latestDone.late_fee_final ?? 0)}</b>. Settle it directly with each other.
          </p>
        )}

        {myReview ? (
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            You left <b>{GRADE_LABEL[myReview.grade]}</b> feedback
            {myReview.comment ? ` — “${myReview.comment}”` : ''}.
            {theirReview
              ? ` They left ${GRADE_LABEL[theirReview.grade]}${theirReview.comment ? ` — “${theirReview.comment}”` : ''}.`
              : ' Their feedback appears here once they have left it.'}
          </p>
        ) : (
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <span className="small muted">
              How did it go? Only the two of you can leave feedback for this deal, and it cannot be changed afterwards.
            </span>
            <div className="grades">
              {GRADES.map((g) => (
                <button key={g.key} type="button" data-on={grade === g.key} data-grade={g.key} onClick={() => setGrade(g.key)}>
                  <b>{g.label}</b>
                  <small>{g.note}</small>
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              maxLength={500}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional: a line about how it went"
              style={{ minHeight: 64 }}
              aria-label="Feedback comment"
            />
            <div>
              <button className="btn primary" disabled={pending || !grade} onClick={sendFeedback}>
                {pending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </div>
        )}
        {phone && (
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Their number: <a href={`tel:${phone}`}>{phone}</a>
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    ) : null;

  // ---- nothing open: offer to record one --------------------------------
  const canRecord = isSeller && listing && listing.status === 'active' && kinds.length > 0;

  return (
    <>
      {feedback}

      {canRecord && !recording && (
        <div className="dealbar quiet">
          <span className="small muted">
            Agreed on the terms? Record the deal so you can both confirm the handover and leave feedback.
          </span>
          <button className="btn" onClick={startRecording}>
            Record a deal
          </button>
        </div>
      )}

      {canRecord && recording && (
        <div className="dealbar">
          <div className="dealbar-head">
            <b>Record the deal</b>
          </div>

          <div className="stack" style={{ gap: 10, marginTop: 8 }}>
            {kinds.length > 1 && (
              <div className="grades two">
                {kinds.map((k) => (
                  <button key={k} type="button" data-on={kind === k} onClick={() => pickKind(k)}>
                    <b>{k === 'sale' ? 'Sold' : 'Rented out'}</b>
                  </button>
                ))}
              </div>
            )}

            {kind !== 'free' && (
              <label className="field" style={{ margin: 0 }}>
                <span>{kind === 'rental' ? 'Rent for the whole period, rupees' : 'Agreed price, rupees'}</span>
                <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
            )}

            {kind === 'rental' && (
              <>
                <div className="row2">
                  <label className="field" style={{ margin: 0 }}>
                    <span>Deposit, rupees</span>
                    <input type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span>Late fee per day</span>
                    <input type="number" min={0} value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
                  </label>
                </div>
                <label className="field" style={{ margin: 0 }}>
                  <span>Must be returned by</span>
                  <input type="datetime-local" value={returnBy} onChange={(e) => setReturnBy(e.target.value)} />
                </label>
                <div className="note">
                  A reminder is sent in this chat 6 hours before this time. After it, the late fee builds up
                  daily, and part of a day counts as a full day.
                </div>
              </>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          <div className="dealbar-actions">
            <button className="btn primary" disabled={pending} onClick={submitDeal}>
              {pending ? 'Saving…' : 'Record deal'}
            </button>
            <button className="btn quiet" disabled={pending} onClick={() => setRecording(false)}>
              Not yet
            </button>
          </div>
        </div>
      )}

      {!isSeller && !hasAnyDeal && (
        <div className="dealbar quiet">
          <span className="small muted">
            Agreed a price? The seller records the deal here. That is what lets you both leave feedback.
          </span>
        </div>
      )}
    </>
  );
}
