import Link from 'next/link';
import { createClient, currentProfile } from '@/lib/supabase/server';
import { saveProfile, signOut } from './actions';
import { initials } from '@/components/shell';
import ListingRow from './listing-row';
import { Shield } from '@/components/icons';
import type { Hostel, Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const me = (await currentProfile())!;
  const supabase = await createClient();

  const [{ data: hostelData }, { data: mine }] = await Promise.all([
    supabase.from('hostels').select('*').order('sort_order'),
    supabase.from('listings').select('*').eq('seller_id', me.id).order('created_at', { ascending: false }),
  ]);

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
              <ListingRow key={l.id} listing={l} hostels={hostels} />
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

          <div className="row2">
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
                Room <em>— kept private</em>
              </span>
              <input name="room_no" defaultValue={me.room_no ?? ''} maxLength={20} />
            </label>
          </div>

          <label className="field">
            <span>
              Phone <em>— optional, shown only to someone you are already chatting with</em>
            </span>
            <input name="phone" defaultValue={me.phone ?? ''} maxLength={20} placeholder="+91" />
          </label>

          <button className="btn primary">Save details</button>
        </form>
      </section>
    </div>
  );
}
