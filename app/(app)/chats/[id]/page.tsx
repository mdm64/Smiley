import { notFound } from 'next/navigation';
import { createClient, currentProfile } from '@/lib/supabase/server';
import Conversation from './conversation';
import type { Listing, Message, Profile } from '@/lib/types';

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
    supabase.from('profiles').select('id, display_name, email, phone, hostel_id').in('id', otherIds),
    supabase.from('listings').select('*').in('id', listingIds),
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(300),
  ]);

  return (
    <Conversation
      me={me}
      threads={threads ?? []}
      currentId={id}
      people={(people ?? []) as Profile[]}
      listings={(listings ?? []) as Listing[]}
      initialMessages={(messages ?? []) as Message[]}
    />
  );
}
