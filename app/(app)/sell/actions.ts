'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { blockedReason, CATEGORIES, CONDITIONS, type Mode } from '@/lib/types';

export type Draft = {
  title: string;
  category: string;
  description: string;
  condition: string;
  mode: Mode;
  price: number;
  rate: number;
  unit: string;
  deposit: number;
  hostel_id: string | null;
  pickup: string;
  attributes: Record<string, string>;
  image_urls: string[];
};

export async function publishListing(draft: Draft): Promise<{ error: string } | never> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session expired. Sign in again.' };

  const title = draft.title.trim();
  if (title.length < 3) return { error: 'Give the item a title.' };

  const blocked = blockedReason(`${title} ${draft.description}`);
  if (blocked) return { error: blocked };

  if (!CATEGORIES.includes(draft.category as (typeof CATEGORIES)[number])) {
    return { error: 'Choose a category.' };
  }
  if (!CONDITIONS.includes(draft.condition as (typeof CONDITIONS)[number])) {
    return { error: 'Choose a condition.' };
  }
  if (!draft.image_urls.length) return { error: 'Add at least one photo.' };

  const sells = draft.mode === 'sell' || draft.mode === 'both';
  const rents = draft.mode === 'rent' || draft.mode === 'both';
  if (sells && draft.price <= 0) return { error: 'Set a selling price.' };
  if (rents && draft.rate <= 0) return { error: 'Set a rental rate.' };
  if (!draft.pickup.trim()) return { error: 'Say when the item can be collected.' };

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: user.id,
      title,
      category: draft.category,
      description: draft.description.trim(),
      condition: draft.condition,
      mode: draft.mode,
      price: draft.mode === 'free' ? 0 : Math.max(0, Math.round(draft.price)),
      rate: rents ? Math.max(0, Math.round(draft.rate)) : 0,
      unit: draft.unit,
      deposit: rents ? Math.max(0, Math.round(draft.deposit)) : 0,
      hostel_id: draft.hostel_id,
      pickup: draft.pickup.trim(),
      attributes: draft.attributes,
      image_urls: draft.image_urls,
    })
    .select('id')
    .single();

  if (error || !data) return { error: 'That did not save. Check your connection and try again.' };

  revalidatePath('/browse');
  revalidatePath('/profile');
  redirect(`/listing/${data.id}`);
}
