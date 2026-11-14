import { notFound } from 'next/navigation';
import { createClient, currentProfile } from '@/lib/supabase/server';
import Conversation from './conversation';
import DealPanel from './deal-panel';
import { reputation } from '@/lib/deals';
import type { Deal, Listing, Message, Profile, Review, UserStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = (await currentProfile())!;
  const supabase = await createClient();

  // Row-level security already limits these to conversations you belong to.
  const { data: threads } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, last_at')
    .order('last_at', { ascending: false })
    .limit(60);

  const current = threads?.find((t) => t.id === id);
  if (!current) notFound();

  const otherIds = [...new Set((threads ?? []).map((t) => (t.buyer_id === me.id ? t.seller_id : t.buyer_id)))];
  const listingIds = [...new Set((threads ?? []).map((t) => t.listing_id))];

  const [{ data: people }, { data: listings }, { data: messages }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email, hostel_id').in('id', otherIds),
    supabase.from('listings').select('*').in('id', listingIds),
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(300),
  ]);

  const otherId = current.buyer_id === me.id ? current.seller_id : current.buyer_id;
  const listing = (listings ?? []).find((l) => l.id === current.listing_id) as Listing | undefined;

  const [{ data: dealRows }, { data: statsRow }] = await Promise.all([
    supabase.from('deals').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('user_stats').select('*').eq('user_id', otherId).maybeSingle(),
  ]);
  const deals = (dealRows ?? []) as Deal[];
  const openDeal = deals.find((d) => d.status === 'agreed') ?? null;
  const latestDone = deals.find((d) => d.status === 'completed') ?? null;
  const phoneDeal = openDeal ?? latestDone;

  const [{ data: phone }, { data: myReviews }] = await Promise.all([
    phoneDeal ? supabase.rpc('counterparty_phone', { p_deal: phoneDeal.id }) : Promise.resolve({ data: null }),
    latestDone
      ? supabase.from('reviews').select('*').eq('deal_id', latestDone.id)
      : Promise.resolve({ data: [] as Review[] }),
  ]);
  const reviews = (myReviews ?? []) as Review[];

  return (
    <Conversation
      otherStatsText={reputation(statsRow as UserStats | null).text}
      dealPanel={
        <DealPanel
          conversationId={id}
          meId={me.id}
          isSeller={current.seller_id === me.id}
          listing={listing ?? null}
          openDeal={openDeal}
          latestDone={latestDone}
          phone={(phone as string | null) ?? null}
          myReview={reviews.find((r) => r.reviewer_id === me.id) ?? null}
          theirReview={reviews.find((r) => r.reviewer_id !== me.id) ?? null}
          hasAnyDeal={deals.length > 0}
        />
      }
      me={me}
      threads={threads ?? []}
      currentId={id}
      people={(people ?? []) as Profile[]}
      listings={(listings ?? []) as Listing[]}
      initialMessages={(messages ?? []) as Message[]}
    />
  );
}
