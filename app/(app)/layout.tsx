import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient, currentProfile } from '@/lib/supabase/server';
import Shell from '@/components/shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await currentProfile();
  if (!profile) redirect('/login');

  const supabase = await createClient();

  const [{ count: savedCount }, { data: convos }] = await Promise.all([
    supabase
      .from('saved_items')
      .select('listing_id', { count: 'exact', head: true })
      .eq('profile_id', profile.id),
    supabase
      .from('conversations')
      .select('id, last_at, messages(sender_id, created_at)')
      .or(`buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`)
      .order('last_at', { ascending: false })
      .limit(50),
  ]);

  // A conversation counts as unread when its newest message came from the other side.
  const unread = (convos ?? []).filter((c) => {
    const msgs = (c.messages ?? []) as { sender_id: string; created_at: string }[];
    if (!msgs.length) return false;
    const newest = msgs.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    return newest.sender_id !== profile.id;
  }).length;

  return (
    <Suspense fallback={null}>
      <Shell profile={profile} savedCount={savedCount ?? 0} unread={unread}>
        {children}
      </Shell>
    </Suspense>
  );
}
