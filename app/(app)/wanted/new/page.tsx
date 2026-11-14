import { createClient, currentProfile } from '@/lib/supabase/server';
import WantedForm from './form';
import type { Hostel } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewWanted() {
  const me = (await currentProfile())!;
  const supabase = await createClient();
  const { data } = await supabase.from('hostels').select('*').order('sort_order');

  return (
    <div className="page">
      <div className="page-head">
        <h1>What are you looking for?</h1>
        <p>Say it once. Anyone who has it can offer it to you in a message.</p>
      </div>
      <WantedForm hostels={(data ?? []) as Hostel[]} defaultHostel={me.hostel_id} />
    </div>
  );
}
