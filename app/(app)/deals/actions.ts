'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { DealKind, Grade } from '@/lib/types';

type Result = { error?: string };

/** Messages raised by our own SQL functions are written for students; anything else is not. */
function friendly(error: { code?: string; message: string }): string {
  return error.code === 'P0001' ? error.message : 'That did not save. Check your connection and try again.';
}

async function call(fn: string, args: Record<string, unknown>, conversationId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session expired. Sign in again.' };

  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: friendly(error) };

  revalidatePath(`/chats/${conversationId}`);
  revalidatePath('/browse');
  revalidatePath('/profile');
  return {};
}

export async function recordDeal(input: {
  conversationId: string;
  kind: DealKind;
  amount: number;
  returnBy?: string;
  lateFee?: number;
  deposit?: number;
}): Promise<Result> {
  if (!['sale', 'rental', 'free'].includes(input.kind)) return { error: 'Choose what kind of deal this is.' };
  const amount = Math.round(Number(input.amount) || 0);
  if (input.kind !== 'free' && amount <= 0) return { error: 'Enter the agreed amount.' };
  if (input.kind === 'rental') {
    const when = Date.parse(input.returnBy ?? '');
    if (!Number.isFinite(when) || when <= Date.now()) return { error: 'Pick a return time in the future.' };
  }
  return call(
    'create_deal',
    {
      p_conversation: input.conversationId,
      p_kind: input.kind,
      p_amount: amount,
      p_return_by: input.kind === 'rental' ? new Date(input.returnBy!).toISOString() : null,
      p_late_fee: Math.round(Number(input.lateFee) || 0),
      p_deposit: Math.round(Number(input.deposit) || 0),
    },
    input.conversationId,
  );
}

export async function confirmHandover(dealId: string, conversationId: string): Promise<Result> {
  return call('confirm_handover', { p_deal: dealId }, conversationId);
}

export async function markReturned(dealId: string, conversationId: string): Promise<Result> {
  return call('mark_returned', { p_deal: dealId }, conversationId);
}

export async function cancelDeal(dealId: string, conversationId: string): Promise<Result> {
  return call('cancel_deal', { p_deal: dealId }, conversationId);
}

export async function leaveFeedback(
  dealId: string,
  conversationId: string,
  grade: Grade,
  comment: string,
): Promise<Result> {
  if (!['positive', 'neutral', 'negative'].includes(grade)) return { error: 'Choose how it went.' };
  const result = await call(
    'submit_review',
    { p_deal: dealId, p_grade: grade, p_comment: comment.trim().slice(0, 500) },
    conversationId,
  );
  return result;
}

async function viaListing(fn: string, args: Record<string, unknown>): Promise<Result & { conversationId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session expired. Sign in again.' };

  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: friendly(error) };

  revalidatePath('/profile');
  revalidatePath('/browse');
  revalidatePath('/chats');
  return { conversationId: data as string };
}

/** "Mark sold" / "Mark given away": records who got it, so the two of you can leave feedback. */
export async function sellTo(input: { listingId: string; buyerId: string; amount: number }) {
  if (!input.buyerId) return { error: 'Choose who you sold it to.' };
  return viaListing('sell_to', {
    p_listing: input.listingId,
    p_buyer: input.buyerId,
    p_amount: Math.max(0, Math.round(Number(input.amount) || 0)),
  });
}

/** "Rent out": records who has it and when it is due back. */
export async function rentTo(input: {
  listingId: string;
  renterId: string;
  amount: number;
  deposit: number;
  lateFee: number;
  returnBy: string;
}) {
  if (!input.renterId) return { error: 'Choose who you rented it to.' };
  const amount = Math.round(Number(input.amount) || 0);
  if (amount <= 0) return { error: 'Enter the rent you agreed.' };
  const when = Date.parse(input.returnBy);
  if (!Number.isFinite(when) || when <= Date.now()) return { error: 'Pick a return time in the future.' };
  return viaListing('rent_to', {
    p_listing: input.listingId,
    p_renter: input.renterId,
    p_amount: amount,
    p_return_by: new Date(when).toISOString(),
    p_late_fee: Math.max(0, Math.round(Number(input.lateFee) || 0)),
    p_deposit: Math.max(0, Math.round(Number(input.deposit) || 0)),
  });
}
