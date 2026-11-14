import Link from 'next/link';
import { createClient, currentProfile } from '@/lib/supabase/server';
import { saveProfile, signOut } from './actions';
import { initials } from '@/lib/format';
import { reputation } from '@/lib/deals';
import ListingRow from './listing-row';
import { Shield } from '@/components/icons';
import type { Hostel, Listing, UserStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const me = (await currentProfile())!;
  const supabase = await createClient();

  const [{ data: hostelData }, { data: mine }, { data: statsRow }, { data: priv }] = await Promise.all([
    supabase.from('hostels').select('*').order('sort_order'),
    supabase.from('listings').select('*').eq('seller_id', me.id).order('created_at', { ascending: false }),
    supabase.from('user_stats').select('*').eq('user_id', me.id).maybeSingle(),
    supabase.from('profile_private').select('phone').eq('id', me.id).maybeSingle(),
  ]);
  const rep = reputation(statsRow as UserStats | null);

  // Who has chatted with me about each listing, so "Mark sold" can ask who bought it.
  const listingIds = (mine ?? []).map((l) => l.id);
  const { data: convoRows } = listingIds.length
    ? await supabase.from('conversations').select('listing_id, buyer_id').eq('seller_id', me.id).in('listing_id', listingIds)
    : { data: [] as { listing_id: string; buyer_id: string }[] };
  const buyerIds = [...new Set((convoRows ?? []).map((c) => c.buyer_id))];
  const { data: buyerRows } = buyerIds.length
    ? await supabase.from('profiles').select('id, display_name, email').in('id', buyerIds)
    : { data: [] as { id: string; display_name: string; email: string }[] };
  const peopleFor = (listingId: string) =>
    (convoRows ?? [])
      .filter((c) => c.listing_id === listingId)
      .map((c) => {
        const b = buyerRows?.find((x) => x.id === c.buyer_id);
        return { id: c.buyer_id, name: b?.display_name || b?.email?.split('@')[0] || 'IIT Delhi student' };
      });

  const hostels = (hostelData ?? []) as Hostel[];
  const listings = (mine ?? []) as Listing[];
  const live = listings.filter((l) => l.status === 'active').length;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Your account</h1>
      </div>

      <div className="panel" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 26 }}>
        <span className="avatar lg">{initials(me.display_name, me.email)}</span>
        <div style={{ minWidth: 0 }}>
          <h2>{me.display_name || me.email.split('@')[0]}</h2>
          <div className="small muted">{me.email}</div>
          <span className="chip rent" style={{ marginTop: 7 }}>
            <Shield size={13} /> Verified institute address
          </span>
          <div className="small muted" style={{ marginTop: 7 }}>
            <Link href={`/u/${me.id}`}>{rep.text}</Link>
          </div>
        </div>
        <form action={signOut} style={{ marginLeft: 'auto' }}>
          <button className="btn">Sign out</button>
        </form>
      </div>

      <section style={{ marginBottom: 34 }}>
        <div className="band-head">
          <h2>Your listings</h2>
          <span className="where" />
          <span className="n">{live} live</span>
        </div>

        {listings.length ? (
          <div className="stack">
            {listings.map((l) => (
              <ListingRow key={l.id} listing={l} hostels={hostels} people={peopleFor(l.id)} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>You have not listed anything</h3>
            <p>Start with the thing you have not touched since first year.</p>
            <Link className="btn primary" href="/sell">
              List an item
            </Link>
          </div>
        )}
      </section>

      <section>
        <div className="band-head">
          <h2>Details</h2>
          <span className="where">Your hostel decides whose list you appear near the top of</span>
        </div>

        <form action={saveProfile} className="form">
          <label className="field">
            <span>Name</span>
            <input name="display_name" defaultValue={me.display_name} maxLength={60} placeholder="How you sign off" />
          </label>

          <label className="field">
            <span>Hostel</span>
            <select name="hostel_id" defaultValue={me.hostel_id ?? ''}>
              <option value="">Not in a hostel</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>
              Phone <em>— optional</em>
            </span>
            <input name="phone" defaultValue={priv?.phone ?? ''} maxLength={20} placeholder="+91" />
            <span className="small muted" style={{ fontWeight: 400, marginTop: 5 }}>
              Never shown on your profile or in listings. The other person sees it only once the two of
              you have recorded a deal. We do not ask for your room number at all.
            </span>
          </label>

          <button className="btn primary">Save details</button>
        </form>
      </section>
    </div>
  );
}
