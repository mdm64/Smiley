'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { respondToWanted, setWantedStatus, deleteWanted } from './actions';
import ShareButton from '@/components/share-button';
import type { Listing, Wanted } from '@/lib/types';

export default function WantedCard({
  wanted,
  mine,
  authorName,
  authorRep,
  hostel,
  budget,
  ago,
  myListings,
}: {
  wanted: Wanted;
  mine: boolean;
  authorName: string;
  authorRep: string;
  hostel: string | null;
  budget: string | null;
  ago: string;
  myListings: Pick<Listing, 'id' | 'title'>[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [offering, setOffering] = useState(false);
  const [listingId, setListingId] = useState(myListings[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const open = wanted.status === 'open';

  const offer = () =>
    start(async () => {
      setError(null);
      const res = await respondToWanted(wanted.id, listingId);
      if (res.error) return setError(res.error);
      router.push(`/chats/${res.conversationId}`);
    });

  return (
    <div className="panel wanted">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <span className="chip">{wanted.category}</span>
        {!open && <span className="chip">{wanted.status === 'fulfilled' ? 'Found' : 'Closed'}</span>}
        <span className="small muted">{ago}</span>
      </div>

      <h3 style={{ marginBottom: 4 }}>{wanted.title}</h3>
      {wanted.description && <p style={{ color: 'var(--ink-2)', maxWidth: '62ch' }}>{wanted.description}</p>}

      <p className="small muted tnum" style={{ margin: '8px 0 0' }}>
        {[
          budget ? `Up to ${budget}` : null,
          wanted.needed_by
            ? `needed by ${new Date(wanted.needed_by + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
            : null,
          hostel ? `in ${hostel}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Any price, any time'}
      </p>
      <p className="small muted" style={{ margin: '4px 0 12px' }}>
        {mine ? 'Your request' : <Link href={`/u/${wanted.author_id}`}>{authorName}</Link>}
        {!mine && ` · ${authorRep}`}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {open && mine && (
          <>
            <button className="btn" disabled={pending} onClick={() => start(() => setWantedStatus(wanted.id, 'fulfilled'))}>
              I found it
            </button>
            <button className="btn" disabled={pending} onClick={() => start(() => setWantedStatus(wanted.id, 'closed'))}>
              Close
            </button>
          </>
        )}
        {!open && mine && (
          <button className="btn" disabled={pending} onClick={() => start(() => setWantedStatus(wanted.id, 'open'))}>
            Reopen
          </button>
        )}
        {mine && (
          <button
            className="btn danger"
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete “${wanted.title}”?`)) start(() => deleteWanted(wanted.id));
            }}
          >
            Delete
          </button>
        )}
        {open && !mine && (
          <button className="btn primary" onClick={() => setOffering((v) => !v)}>
            I have this
          </button>
        )}
        {open && (
          <ShareButton
            wide={false}
            label="Share"
            path="/wanted"
            message={`Someone at IIT Delhi is looking for: ${wanted.title}${budget ? ` (up to ${budget})` : ''}. Got one? Offer it on ReLoop:`}
          />
        )}
      </div>

      {offering && !mine && (
        <div className="note" style={{ marginTop: 12 }}>
          {myListings.length ? (
            <div className="stack" style={{ gap: 10 }}>
              <label className="field" style={{ margin: 0 }}>
                <span>Which of your listings fits?</span>
                <select value={listingId} onChange={(e) => setListingId(e.target.value)}>
                  {myListings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn primary" disabled={pending || !listingId} onClick={offer}>
                {pending ? 'Sending…' : 'Message them about it'}
              </button>
              {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            </div>
          ) : (
            <span>
              Offers go out as one of your listings, so people see photos and a price.{' '}
              <Link href="/sell">List it first</Link>, then come back here.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
