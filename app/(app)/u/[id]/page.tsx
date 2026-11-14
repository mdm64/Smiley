import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, currentProfile } from '@/lib/supabase/server';
import { initials, timeAgo } from '@/lib/format';
import { reputation } from '@/lib/deals';
import ListingCard from '@/components/listing-card';
import { Shield } from '@/components/icons';
import type { Hostel, Listing, Profile, Review, UserStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

const GRADE_LABEL = { positive: 'Positive', neutral: 'Okay', negative: 'Negative' } as const;

export default async function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = (await currentProfile())!;
  const supabase = await createClient();

  const { data: person } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!person) notFound();
  const p = person as Profile;

  const [{ data: statsRow }, { data: reviewData }, { data: listingData }, { data: hostelData }, { data: savedData }] =
    await Promise.all([
      supabase.from('user_stats').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('reviews').select('*').eq('reviewee_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('listings').select('*').eq('seller_id', id).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('hostels').select('*').order('sort_order'),
      supabase.from('saved_items').select('listing_id').eq('profile_id', me.id),
    ]);

  const reviews = (reviewData ?? []) as Review[];
  const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
  const { data: reviewers } = reviewerIds.length
    ? await supabase.from('profiles').select('id, display_name, email').in('id', reviewerIds)
    : { data: [] as Pick<Profile, 'id' | 'display_name' | 'email'>[] };

  const rep = reputation(statsRow as UserStats | null);
  const hostels = (hostelData ?? []) as Hostel[];
  const listings = (listingData ?? []) as Listing[];
  const saved = new Set((savedData ?? []).map((s) => s.listing_id));
  const hostel = hostels.find((h) => h.id === p.hostel_id);
  const nameOf = (rid: string) => {
    const r = reviewers?.find((x) => x.id === rid);
    return r?.display_name || 'An IIT Delhi student';
  };

  return (
    <div className="page">
      <div className="panel" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 26 }}>
        <span className="avatar lg">{initials(p.display_name, p.email)}</span>
        <div style={{ minWidth: 0 }}>
          <h2>{p.display_name || 'IIT Delhi student'}</h2>
          <div className="small muted">
            {hostel ? `${hostel.name} · ` : ''}Joined {new Date(p.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </div>
          <span className="chip rent" style={{ marginTop: 7 }}>
            <Shield size={13} /> Verified institute address
          </span>
        </div>
      </div>

      <section style={{ marginBottom: 30 }}>
        <div className="band-head">
          <h2>Feedback</h2>
          <span className="where">Only people who completed a deal with them can leave it</span>
        </div>
        <div className="panel">
          <div className="stat-row">
            <div>
              <div className="bignum tnum" style={{ fontSize: 'var(--step-2)' }}>{rep.percent === null ? '—' : `${rep.percent}%`}</div>
              <div className="small muted">positive</div>
            </div>
            <div>
              <div className="bignum tnum" style={{ fontSize: 'var(--step-2)' }}>{rep.completed}</div>
              <div className="small muted">{rep.completed === 1 ? 'exchange' : 'exchanges'}</div>
            </div>
            <div className="small muted tnum">
              {rep.positive} positive · {rep.neutral} okay · {rep.negative} negative
            </div>
          </div>

          {reviews.length ? (
            <ul className="reviews">
              {reviews.map((r) => (
                <li key={r.id}>
                  <div>
                    <span className={`chip grade-${r.grade}`}>{GRADE_LABEL[r.grade]}</span>{' '}
                    <span className="small muted">
                      as {r.reviewee_role} · from {nameOf(r.reviewer_id)} · {timeAgo(r.created_at)}
                    </span>
                  </div>
                  {r.comment && <p>{r.comment}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted" style={{ marginTop: 14 }}>No feedback yet.</p>
          )}
        </div>
      </section>

      <section>
        <div className="band-head">
          <h2>Listed now</h2>
          <span className="where" />
          <span className="n">{listings.length}</span>
        </div>
        {listings.length ? (
          <div className="grid">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} hostels={hostels} saved={saved.has(l.id)} />
            ))}
          </div>
        ) : (
          <p className="muted small">Nothing listed right now.</p>
        )}
      </section>

      {p.id === me.id && (
        <p className="small muted" style={{ marginTop: 20 }}>
          This is how other students see you. <Link href="/profile">Back to your account</Link>
        </p>
      )}
    </div>
  );
}
