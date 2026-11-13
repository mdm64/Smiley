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
  const room_no = String(formData.get('room_no') ?? '').trim().slice(0, 20) || null;
  const phone = String(formData.get('phone') ?? '').trim().slice(0, 20) || null;

  await supabase.from('profiles').update({ display_name, hostel_id, room_no, phone }).eq('id', user.id);

  revalidatePath('/profile');
  revalidatePath('/browse');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
