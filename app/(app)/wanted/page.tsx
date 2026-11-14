import Link from 'next/link';
import { createClient, currentProfile } from '@/lib/supabase/server';
import { rupees, timeAgo } from '@/lib/format';
import { reputation } from '@/lib/deals';
import WantedCard from './card';
import { Plus } from '@/components/icons';
import type { Hostel, Listing, Profile, UserStats, Wanted } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function WantedBoard() {
  const me = (await currentProfile())!;
  const supabase = await createClient();

  const [{ data: wantedData }, { data: hostelData }, { data: myListings }] = await Promise.all([
    supabase.from('wanted_posts').select('*').order('created_at', { ascending: false }).limit(150),
    supabase.from('hostels').select('*').order('sort_order'),
    supabase.from('listings').select('id, title, mode, price, rate, unit').eq('seller_id', me.id).eq('status', 'active'),
  ]);

  const posts = (wantedData ?? []) as Wanted[];
  const authorIds = [...new Set(posts.map((w) => w.author_id))];
  const [{ data: authors }, { data: statRows }] = authorIds.length
    ? await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', authorIds),
        supabase.from('user_stats').select('*').in('user_id', authorIds),
      ])
    : [{ data: [] }, { data: [] }];

  const hostels = (hostelData ?? []) as Hostel[];
  const open = posts.filter((w) => w.status === 'open');
  const mine = posts.filter((w) => w.author_id === me.id && w.status !== 'open');

  const render = (w: Wanted) => {
    const author = (authors as Pick<Profile, 'id' | 'display_name'>[] | null)?.find((a) => a.id === w.author_id);
    const stats = (statRows as UserStats[] | null)?.find((s) => s.user_id === w.author_id);
    return (
      <WantedCard
        key={w.id}
        wanted={w}
        mine={w.author_id === me.id}
        authorName={author?.display_name || 'An IIT Delhi student'}
        authorRep={reputation(stats).text}
        hostel={hostels.find((h) => h.id === w.hostel_id)?.name ?? null}
        budget={w.max_budget ? rupees(w.max_budget) : null}
        ago={timeAgo(w.created_at)}
        myListings={(myListings ?? []) as Pick<Listing, 'id' | 'title'>[]}
      />
    );
  };

  return (
    <div className="page">
      <div className="page-head" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1>Wanted</h1>
          <p>
            Looking for something nobody has listed yet? Ask for it. Whoever has one can offer it to you
            straight from their listings.
          </p>
        </div>
        <Link className="btn primary" href="/wanted/new">
          <Plus size={16} /> I want something
        </Link>
      </div>

      {open.length ? (
        <div className="stack">{open.map(render)}</div>
      ) : (
        <div className="empty">
          <h3>Nobody is asking for anything right now</h3>
          <p>Need a heater, a formal shirt or a lab coat? Post it and let it find you.</p>
          <Link className="btn primary" href="/wanted/new">
            Post a request
          </Link>
        </div>
      )}

      {mine.length > 0 && (
        <section style={{ marginTop: 34 }}>
          <div className="band-head">
            <h2>Your closed requests</h2>
            <span className="where" />
          </div>
          <div className="stack">{mine.map(render)}</div>
        </section>
      )}
    </div>
  );
}
