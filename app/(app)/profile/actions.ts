'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const display_name = String(formData.get('display_name') ?? '').trim().slice(0, 60);
  const hostel_id = String(formData.get('hostel_id') ?? '') || null;
  const phone = String(formData.get('phone') ?? '').trim().slice(0, 20) || null;

  await supabase.from('profiles').update({ display_name, hostel_id }).eq('id', user.id);
  // The phone number lives in its own table that only its owner can read.
  await supabase.from('profile_private').upsert({ id: user.id, phone });

  revalidatePath('/profile');
  revalidatePath('/browse');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
