import Link from 'next/link';
import { createClient, currentProfile } from '@/lib/supabase/server';
import ListingCard from '@/components/listing-card';
import type { Hostel, Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const me = (await currentProfile())!;
  const supabase = await createClient();

  const [{ data: rows }, { data: hostelData }] = await Promise.all([
    supabase
      .from('saved_items')
      .select('listing_id, created_at, listings(*)')
      .eq('profile_id', me.id)
      .order('created_at', { ascending: false }),
    supabase.from('hostels').select('*').order('sort_order'),
  ]);

  const hostels = (hostelData ?? []) as Hostel[];
  const listings = (rows ?? [])
    .map((r) => r.listings as unknown as Listing)
    .filter(Boolean);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Saved</h1>
        <p>Kept on your account, so it follows you to your phone.</p>
      </div>

      {listings.length ? (
        <div className="grid">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} hostels={hostels} saved showStatus />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>Nothing saved yet</h3>
          <p>Tap the heart on anything you are thinking about. It waits here.</p>
          <Link className="btn primary" href="/browse">
            Browse the marketplace
          </Link>
        </div>
      )}
    </div>
  );
}
