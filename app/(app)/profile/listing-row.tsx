'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { setListingStatus, deleteListing } from '@/app/(app)/actions';
import { priceLabel } from '@/lib/format';
import { Image as ImageIcon } from '@/components/icons';
import type { Hostel, Listing } from '@/lib/types';

export default function ListingRow({ listing, hostels }: { listing: Listing; hostels: Hostel[] }) {
  const [pending, start] = useTransition();
  const price = priceLabel(listing);
  const hostel = hostels.find((h) => h.id === listing.hostel_id);
  const live = listing.status === 'active';
  const paused = listing.status === 'paused';
  const closed = listing.status === 'sold' || listing.status === 'given';

  return (
    <div className="panel" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12 }}>
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
            <button
              className="btn"
              disabled={pending}
              onClick={() =>
                start(() =>
                  setListingStatus(listing.id, listing.mode === 'free' ? 'given' : 'sold').then(() => {}),
                )
              }
            >
              {listing.mode === 'free' ? 'Mark given away' : 'Mark sold'}
            </button>
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
    </div>
  );
}
