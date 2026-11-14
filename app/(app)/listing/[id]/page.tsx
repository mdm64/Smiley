import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient, currentProfile } from '@/lib/supabase/server';
import { rupees, priceLabel, modeChip, timeAgo, initials } from '@/lib/format';
import SaveButton from '@/components/save-button';
import ShareButton from '@/components/share-button';
import { reputation } from '@/lib/deals';
import Gallery from './gallery';
import ContactPanel from './contact';
import { Pin, Image as ImageIcon } from '@/components/icons';
import type { Hostel, Listing, Profile, UserStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

// What WhatsApp, Telegram and friends show when the link is pasted into a chat.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  if (!data) return { title: 'ReLoop — the IIT Delhi campus marketplace' };
  const l = data as Listing;
  const price = priceLabel(l);
  const title = `${l.title} — ${price.value}${price.suffix ? ' ' + price.suffix : ''}`;
  const description = [l.condition, l.description].filter(Boolean).join(' · ').slice(0, 180) ||
    'Second-hand, rented and free things from IIT Delhi students, on ReLoop.';
  const image = l.image_urls[0];
  return {
    title: `${title} · ReLoop`,
    description,
    openGraph: { title, description, type: 'website', siteName: 'ReLoop', ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentProfile(); // null when signed out
  const supabase = await createClient();

  const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const listing = data as Listing;

  const none = Promise.resolve({ data: null });
  const [{ data: sellerData }, { data: hostelData }, { data: savedRow }, { data: convo }, { data: statsRow }] =
    await Promise.all([
      me ? supabase.from('profiles').select('*').eq('id', listing.seller_id).maybeSingle() : none,
      supabase.from('hostels').select('*').order('sort_order'),
      me
        ? supabase.from('saved_items').select('listing_id').eq('profile_id', me.id).eq('listing_id', id).maybeSingle()
        : none,
      me
        ? supabase.from('conversations').select('id').eq('listing_id', id).eq('buyer_id', me.id).maybeSingle()
        : none,
      me ? supabase.from('user_stats').select('*').eq('user_id', listing.seller_id).maybeSingle() : none,
    ]);
  const rep = reputation(statsRow as UserStats | null);

  const seller = sellerData as Profile | null;
  const hostels = (hostelData ?? []) as Hostel[];
  const hostel = hostels.find((h) => h.id === listing.hostel_id);
  const price = priceLabel(listing);
  const chip = modeChip(listing.mode);
  const mine = Boolean(me) && listing.seller_id === me!.id;
  const canRent = listing.mode === 'rent' || listing.mode === 'both';
  const canBuy = listing.mode === 'sell' || listing.mode === 'both' || listing.mode === 'free';
  const attributes = Object.entries(listing.attributes ?? {}).filter(([, v]) => v);

  return (
    <div className="page">
      <Link className="btn quiet" href="/browse" style={{ marginBottom: 14 }}>
        ← All listings
      </Link>

      <div className="detail">
        <div>
          {listing.image_urls.length ? (
            <Gallery images={listing.image_urls} title={listing.title} />
          ) : (
            <div
              className="gallery"
              style={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center',
                background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)',
                color: 'var(--ink-3)' }}
            >
              <ImageIcon size={32} />
            </div>
          )}
        </div>

        <div className="stack">
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span className={`chip ${chip.cls}`}>{chip.text}</span>
              <span className="chip">{listing.condition}</span>
              {listing.status !== 'active' && <span className="chip">No longer available</span>}
              {me && (
                <span style={{ marginLeft: 'auto', position: 'relative', width: 30, height: 30 }}>
                  <SaveButton listingId={listing.id} saved={Boolean(savedRow)} title={listing.title} />
                </span>
              )}
            </div>

            <h1 style={{ fontSize: 'var(--step-2)' }}>{listing.title}</h1>

            <div className="pricebar">
              <span className={`bignum${price.rent ? ' rent' : ''}`}>
                {price.value}
                {price.suffix && <small> {price.suffix}</small>}
              </span>
              {listing.mode === 'both' && (
                <span className="muted">
                  or {rupees(listing.rate)} per {listing.unit} to rent
                </span>
              )}
              {canRent && listing.deposit > 0 && (
                <span className="muted small">{rupees(listing.deposit)} deposit, refundable</span>
              )}
            </div>
          </div>

          {listing.description && (
            <p style={{ color: 'var(--ink-2)', maxWidth: '62ch' }}>{listing.description}</p>
          )}

          <dl className="spec">
            <div>
              <dt>Category</dt>
            </div>
            <div>
              <dd>{listing.category}</dd>
            </div>
            <div>
              <dt>Collect from</dt>
            </div>
            <div>
              <dd>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Pin /> {hostel?.name ?? 'On campus'}
                </span>
                {listing.pickup && <div className="small muted">{listing.pickup}</div>}
              </dd>
            </div>
            {attributes.map(([k, v]) => (
              <Attribute key={k} label={k} value={String(v)} />
            ))}
            <div>
              <dt>Listed</dt>
            </div>
            <div>
              <dd>{timeAgo(listing.created_at)}</dd>
            </div>
          </dl>

          {me && (
          <Link href={`/u/${listing.seller_id}`} className="seller">
            <span className="avatar">{initials(seller?.display_name ?? '', seller?.email ?? '?')}</span>
            <div>
              <b>{mine ? 'You' : seller?.display_name || 'An IIT Delhi student'}</b>
              <div className="small muted">
                {mine ? 'This is your listing · ' : 'Verified IIT Delhi account · '}
                {rep.text}
              </div>
            </div>
          </Link>
          )}

          {!me ? (
            <div className="panel signin-cta">
              <b>Interested?</b>
              <span className="small muted">
                Sign in with your IIT Delhi email to message the seller, make an offer and see their feedback.
              </span>
              <Link className="btn primary wide" href={`/login?next=/listing/${listing.id}`}>
                Sign in to contact the seller
              </Link>
            </div>
          ) : mine ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <Link className="btn primary wide" href={`/listing/${listing.id}/edit`}>
                Edit this listing
              </Link>
              <Link className="btn wide" href="/profile">
                Manage this listing
              </Link>
            </div>
          ) : listing.status !== 'active' ? (
            <div className="note">This item has been marked as no longer available.</div>
          ) : (
            <ContactPanel
              listingId={listing.id}
              existingConversation={convo?.id ?? null}
              canRent={canRent}
              canBuy={canBuy}
              mode={listing.mode}
              rate={listing.rate}
              unit={listing.unit}
              deposit={listing.deposit}
              price={listing.price}
              title={listing.title}
            />
          )}

          <ShareButton
            path={`/listing/${listing.id}`}
            message={`${listing.title} — ${price.value}${price.suffix ? ' ' + price.suffix : ''} at IIT Delhi. Found on ReLoop, the student marketplace:`}
          />

          <p className="small muted">
            ReLoop never takes payment or holds a deposit. Look at the item, then pay the student
            directly.
          </p>
        </div>
      </div>
    </div>
  );
}

function Attribute({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div>
        <dt>{label}</dt>
      </div>
      <div>
        <dd>{value}</dd>
      </div>
    </>
  );
}
