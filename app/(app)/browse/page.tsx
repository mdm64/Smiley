import Link from 'next/link';
import { createClient, currentProfile } from '@/lib/supabase/server';
import ListingCard from '@/components/listing-card';
import Filters from './filters';
import { distanceBand, BAND_COPY, type Band } from '@/lib/format';
import type { Hostel, Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Search = {
  q?: string;
  category?: string;
  mode?: string;
  max?: string;
  hostel?: string;
  sort?: string;
};

export default async function Browse({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const profile = (await currentProfile())!;
  const supabase = await createClient();

  let query = supabase.from('listings').select('*').eq('status', 'active');

  if (params.q) query = query.or(`title.ilike.%${params.q}%,description.ilike.%${params.q}%`);
  if (params.category) query = query.eq('category', params.category);
  if (params.hostel) query = query.eq('hostel_id', params.hostel);
  if (params.mode === 'buy') query = query.in('mode', ['sell', 'both']);
  if (params.mode === 'rent') query = query.in('mode', ['rent', 'both']);
  if (params.mode === 'free') query = query.eq('mode', 'free');

  const sort = params.sort ?? 'recent';
  query =
    sort === 'low'
      ? query.order('price', { ascending: true })
      : sort === 'high'
        ? query.order('price', { ascending: false })
        : query.order('created_at', { ascending: false });

  const [{ data: listingData }, { data: hostelData }, { data: savedData }] = await Promise.all([
    query.limit(200),
    supabase.from('hostels').select('*').order('sort_order'),
    supabase.from('saved_items').select('listing_id').eq('profile_id', profile.id),
  ]);

  const hostels = (hostelData ?? []) as Hostel[];
  const saved = new Set((savedData ?? []).map((s) => s.listing_id));
  let listings = (listingData ?? []) as Listing[];

  if (params.max) {
    const cap = Number(params.max);
    if (Number.isFinite(cap)) {
      listings = listings.filter((l) => (l.mode === 'rent' ? l.rate : l.price) <= cap);
    }
  }

  const filtering = Boolean(params.q || params.category || params.mode || params.max || params.hostel);
  const myHostel = hostels.find((h) => h.id === profile.hostel_id);

  // The organising idea: sort by how far you would have to walk, not by a flat grid.
  const bands: Record<Band, Listing[]> = { here: [], near: [], campus: [] };
  for (const l of listings) bands[distanceBand(l.hostel_id, profile.hostel_id, hostels)].push(l);

  const order: Band[] = ['here', 'near', 'campus'];
  const anything = listings.length > 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1>{params.q ? `“${params.q}”` : 'What your campus is letting go of'}</h1>
        <p>
          {profile.hostel_id
            ? 'Closest first, so you know what is a two-minute walk and what is a cycle ride.'
            : 'Add your hostel in your profile and this sorts itself by how far you have to walk.'}
        </p>
      </div>

      <Filters hostels={hostels} />

      {!anything && (
        <div className="empty">
          <h3>{filtering ? 'Nothing matches that yet' : 'Nothing listed yet'}</h3>
          <p>
            {filtering
              ? 'Try a wider price range, or clear the filters.'
              : 'Be the first. That spare kettle is somebody’s first week sorted.'}
          </p>
          <Link className="btn primary" href={filtering ? '/browse' : '/sell'}>
            {filtering ? 'Clear filters' : 'List an item'}
          </Link>
        </div>
      )}

      {order.map((band) => {
        const items = bands[band];
        if (!items.length) return null;
        const copy = BAND_COPY[band];
        const names =
          band === 'near'
            ? hostels
                .filter((h) => h.zone === myHostel?.zone && h.id !== myHostel?.id)
                .map((h) => h.name)
                .join(', ')
            : copy.hint;

        return (
          <section className="band" key={band}>
            <div className="band-head">
              <h2>{copy.title(myHostel?.name)}</h2>
              <span className="where">{names}</span>
              <span className="n">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="grid">
              {items.map((l) => (
                <ListingCard key={l.id} listing={l} hostels={hostels} saved={saved.has(l.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
