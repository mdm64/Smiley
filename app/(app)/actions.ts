'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function toggleSave(listingId: string, saved: boolean) {
  const { supabase, user } = await me();
  if (!user) return;

  if (saved) {
    await supabase.from('saved_items').delete().eq('profile_id', user.id).eq('listing_id', listingId);
  } else {
    await supabase.from('saved_items').insert({ profile_id: user.id, listing_id: listingId });
  }
  revalidatePath('/browse');
  revalidatePath('/saved');
  revalidatePath(`/listing/${listingId}`);
}

export async function setListingStatus(listingId: string, status: string) {
  const { supabase, user } = await me();
  if (!user) return;
  // The row-level policy also checks ownership, so a forged id changes nothing.
  await supabase.from('listings').update({ status }).eq('id', listingId).eq('seller_id', user.id);
  revalidatePath('/profile');
  revalidatePath('/browse');
}

export async function deleteListing(listingId: string) {
  const { supabase, user } = await me();
  if (!user) return;
  await supabase.from('listings').delete().eq('id', listingId).eq('seller_id', user.id);
  revalidatePath('/profile');
  revalidatePath('/browse');
}

/** Opens the conversation for this listing, or returns the existing one. */
export async function openConversation(listingId: string): Promise<string | null> {
  const { supabase, user } = await me();
  if (!user) return null;

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id')
    .eq('id', listingId)
    .single();
  if (!listing || listing.seller_id === user.id) return null;

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, buyer_id: user.id, seller_id: listing.seller_id })
    .select('id')
    .single();

  return created?.id ?? null;
}

export async function sendMessage(conversationId: string, body: string, offerAmount?: number) {
  const { supabase, user } = await me();
  if (!user) return;
  const text = body.trim().slice(0, 2000);
  if (!text) return;

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: text,
    offer_amount: offerAmount ?? null,
  });
  revalidatePath(`/chats/${conversationId}`);
  revalidatePath('/chats');
}
