'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setListingStatus, deleteListing } from '@/app/(app)/actions';
import { sellTo, rentTo } from '@/app/(app)/deals/actions';
import { priceLabel } from '@/lib/format';
import { suggestedLateFee } from '@/lib/deals';
import { UNIT_DAYS } from '@/lib/rental';
import { Image as ImageIcon } from '@/components/icons';
import type { Hostel, Listing } from '@/lib/types';

export type Person = { id: string; name: string };

/** Tomorrow, 6 pm, in the shape a datetime-local input wants. */
function defaultReturn() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ListingRow({
  listing,
  hostels,
  people,
}: {
  listing: Listing;
  hostels: Hostel[];
  /** Students who chatted with you about this item. */
  people: Person[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const price = priceLabel(listing);
  const hostel = hostels.find((h) => h.id === listing.hostel_id);
  const live = listing.status === 'active';
  const paused = listing.status === 'paused';
  const closed = listing.status === 'sold' || listing.status === 'given';

  const canSell = listing.mode !== 'rent';
  const canRent = listing.mode === 'rent' || listing.mode === 'both';

  const [picking, setPicking] = useState<null | 'sell' | 'rent'>(null);
  const [who, setWho] = useState<string>(''); // '' nobody yet, 'outside' = not through ReLoop
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [lateFee, setLateFee] = useState('');
  const [returnBy, setReturnBy] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (kind: 'sell' | 'rent') => {
    setPicking(kind);
    setWho(people.length === 1 ? people[0].id : '');
    setAmount(String(kind === 'rent' ? listing.rate : listing.price));
    setDeposit(String(listing.deposit || 0));
    setLateFee(String(suggestedLateFee(listing.rate, UNIT_DAYS[listing.unit])));
    setReturnBy(defaultReturn());
    setError(null);
  };

  const kindWord = picking === 'rent' ? 'rented' : 'sold';

  const confirm_ = () => {
    if (!who) return setError(kindWord === 'sold' ? 'Choose who you sold it to.' : 'Choose who you rented it to.');
    setError(null);
    start(async () => {
      if (picking === 'sell') {
        if (who === 'outside') {
          await setListingStatus(listing.id, listing.mode === 'free' ? 'given' : 'sold');
          setPicking(null);
          router.refresh();
          return;
        }
        const res = await sellTo({ listingId: listing.id, buyerId: who, amount: Number(amount) });
        if (res.error) return setError(res.error);
        router.push(`/chats/${res.conversationId}`); // feedback opens right there
      } else {
        const res = await rentTo({
          listingId: listing.id,
          renterId: who,
          amount: Number(amount),
          deposit: Number(deposit),
          lateFee: Number(lateFee),
          returnBy,
        });
        if (res.error) return setError(res.error);
        router.push(`/chats/${res.conversationId}`);
      }
    });
  };

  return (
    <div className="panel" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, flexWrap: 'wrap' }}>
      <Link href={`/listing/${listing.id}`} style={{ flex: '0 0 74px' }}>
        {listing.image_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_urls[0]}
            alt=""
            style={{ width: 74, height: 58, objectFit: 'cover', borderRadius: 6, display: 'block' }}
          />
        ) : (
          <div
            style={{ width: 74, height: 58, borderRadius: 6, background: 'var(--paper-2)',
              display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}
          >
            <ImageIcon size={18} />
          </div>
        )}
      </Link>

      <div style={{ minWidth: 0, flex: 1 }}>
        <Link href={`/listing/${listing.id}`}>
          <b>{listing.title}</b>
        </Link>
        <div className="small muted tnum">
          {price.value} {price.suffix} · {hostel?.name ?? 'On campus'}
        </div>
        {!live && (
          <span className="chip" style={{ marginTop: 5 }}>
            {paused ? 'Paused' : closed ? (listing.status === 'sold' ? 'Sold' : 'Given away') : 'Hidden'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {(live || paused) && (
          <>
            <button
              className="btn"
              disabled={pending}
              onClick={() => start(() => setListingStatus(listing.id, live ? 'paused' : 'active').then(() => {}))}
            >
              {live ? 'Pause' : 'Put back up'}
            </button>
            {canSell && (
              <button className="btn" disabled={pending} onClick={() => open('sell')}>
                {listing.mode === 'free' ? 'Mark given away' : 'Mark sold'}
              </button>
            )}
            {canRent && (
              <button className="btn" disabled={pending} onClick={() => open('rent')}>
                Rent out
              </button>
            )}
          </>
        )}
        <Link className="btn" href={`/listing/${listing.id}/edit`}>
          Edit
        </Link>
        <button
          className="btn danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete “${listing.title}” for good?`)) {
              start(() => deleteListing(listing.id).then(() => {}));
            }
          }}
        >
          Delete
        </button>
      </div>

      {picking && (
        <div className="picker">
          <b>
            {picking === 'rent'
              ? 'Who did you rent it to?'
              : listing.mode === 'free'
                ? 'Who did you give it to?'
                : 'Who did you sell it to?'}
          </b>
          <span className="small muted">
            Pick from the students who chatted with you about this item. That is what lets the two of you
            leave each other feedback.
          </span>

          <div className="who">
            {people.map((p) => (
              <button key={p.id} type="button" data-on={who === p.id} onClick={() => setWho(p.id)}>
                {p.name}
              </button>
            ))}
            {picking === 'sell' && (
              <button type="button" data-on={who === 'outside'} onClick={() => setWho('outside')}>
                Someone outside ReLoop (no feedback)
              </button>
            )}
          </div>
          {people.length === 0 && (
            <span className="small muted">
              Nobody has messaged you about this item on ReLoop yet.
              {picking === 'rent' ? ' A rental needs someone from your chats.' : ''}
            </span>
          )}

          {who && (
            <div className="stack" style={{ gap: 10 }}>
              {listing.mode !== 'free' && who !== 'outside' && (
                <label className="field" style={{ margin: 0 }}>
                  <span>{picking === 'rent' ? 'Rent for the whole period, rupees' : 'Price you agreed, rupees'}</span>
                  <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
              )}
              {picking === 'rent' && (
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
                    A reminder is sent in your chat 6 hours before this time. Late fees add up daily after it.
                  </div>
                </>
              )}
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <div className="dealbar-actions" style={{ marginTop: 0 }}>
            <button className="btn primary" disabled={pending || !who} onClick={confirm_}>
              {pending ? 'Saving…' : picking === 'rent' ? 'Confirm rental' : 'Confirm'}
            </button>
            <button className="btn quiet" disabled={pending} onClick={() => setPicking(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
