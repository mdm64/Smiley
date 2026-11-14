'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { blockedReason, CATEGORIES } from '@/lib/types';

export type WantedDraft = {
  title: string;
  description: string;
  category: string;
  max_budget: number | null;
  needed_by: string | null;
  hostel_id: string | null;
};

export async function postWanted(draft: WantedDraft): Promise<{ error: string } | never> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session expired. Sign in again.' };

  const title = draft.title.trim();
  if (title.length < 3) return { error: 'Say what you are looking for.' };
  const description = draft.description.trim().slice(0, 600);

  const blocked = blockedReason(`${title} ${description}`);
  if (blocked) return { error: blocked };

  const category = CATEGORIES.includes(draft.category as (typeof CATEGORIES)[number]) ? draft.category : 'Other';
  const budget = draft.max_budget && draft.max_budget > 0 ? Math.round(draft.max_budget) : null;
  const needed = draft.needed_by && /^\d{4}-\d{2}-\d{2}$/.test(draft.needed_by) ? draft.needed_by : null;

  const { error } = await supabase.from('wanted_posts').insert({
    author_id: user.id,
    title,
    description,
    category,
    max_budget: budget,
    needed_by: needed,
    hostel_id: draft.hostel_id || null,
  });
  if (error) return { error: 'That did not save. Check your connection and try again.' };

  revalidatePath('/wanted');
  redirect('/wanted');
}

export async function setWantedStatus(id: string, status: 'open' | 'fulfilled' | 'closed') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('wanted_posts').update({ status }).eq('id', id).eq('author_id', user.id);
  revalidatePath('/wanted');
}

export async function deleteWanted(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('wanted_posts').delete().eq('id', id).eq('author_id', user.id);
  revalidatePath('/wanted');
}

/** Offer one of your listings to someone who asked for it. Returns the chat to open. */
export async function respondToWanted(
  wantedId: string,
  listingId: string,
): Promise<{ error?: string; conversationId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session expired. Sign in again.' };

  const { data, error } = await supabase.rpc('respond_to_wanted', { p_wanted: wantedId, p_listing: listingId });
  if (error) {
    return { error: error.code === 'P0001' ? error.message : 'That did not send. Try again.' };
  }
  revalidatePath('/chats');
  return { conversationId: data as string };
}
