import Link from 'next/link';
import SaveButton from '@/components/save-button';
import { priceLabel, modeChip, timeAgo } from '@/lib/format';
import { Image as ImageIcon, Pin } from '@/components/icons';
import type { Listing, Hostel } from '@/lib/types';

export default function ListingCard({
  listing,
  hostels,
  saved,
  showStatus,
  publicView,
}: {
  listing: Listing;
  hostels: Hostel[];
  saved: boolean;
  showStatus?: boolean;
  publicView?: boolean;
}) {
  const price = priceLabel(listing);
  const chip = modeChip(listing.mode);
  const hostel = hostels.find((h) => h.id === listing.hostel_id);
  const gone = listing.status !== 'active';

  return (
    <article className={`card${gone ? ' gone' : ''}`}>
      <Link href={`/listing/${listing.id}`} aria-label={listing.title}>
        {listing.image_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="shot" src={listing.image_urls[0]} alt="" loading="lazy" />
        ) : (
          <div className="shot" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
            <ImageIcon />
          </div>
        )}
      </Link>

      <span className={`chip ${chip.cls} flag`}>{showStatus && gone ? statusWord(listing.status) : chip.text}</span>
      {!publicView && <SaveButton listingId={listing.id} saved={saved} title={listing.title} />}

      <div className="body">
        <Link href={`/listing/${listing.id}`}>
          <div className={`price${price.rent ? ' rent' : ''}`}>
            {price.value}
            {price.suffix && <small> {price.suffix}</small>}
          </div>
          <div className="name">{listing.title}</div>
        </Link>
        <div className="at">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Pin /> {hostel?.name ?? 'Campus'}
          </span>
          <span>{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </article>
  );
}

function statusWord(status: Listing['status']) {
  return status === 'sold' ? 'Sold' : status === 'given' ? 'Given away' : status === 'paused' ? 'Paused' : 'Hidden';
}
