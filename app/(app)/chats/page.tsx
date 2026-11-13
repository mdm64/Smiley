import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, currentProfile } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ChatsIndex() {
  const me = (await currentProfile())!;
  const supabase = await createClient();

  const { data } = await supabase
    .from('conversations')
    .select('id')
    .or(`buyer_id.eq.${me.id},seller_id.eq.${me.id}`)
    .order('last_at', { ascending: false })
    .limit(1);

  if (data?.length) redirect(`/chats/${data[0].id}`);

  return (
    <div className="page">
      <div className="empty" style={{ marginTop: 40 }}>
        <h3>No conversations yet</h3>
        <p>Find something you need and message whoever has it. Chats appear here.</p>
        <Link className="btn primary" href="/browse">
          Browse the marketplace
        </Link>
      </div>
    </div>
  );
}
