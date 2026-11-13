import { createClient, currentProfile } from '@/lib/supabase/server';
import SellForm from './form';
import type { Hostel } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SellPage() {
  const profile = (await currentProfile())!;
  const supabase = await createClient();
  const { data } = await supabase.from('hostels').select('*').order('sort_order');

  return (
    <div className="page">
      <div className="page-head">
        <h1>List something</h1>
        <p>Four short steps. Photos first, because that is what people actually look at.</p>
      </div>
      <SellForm hostels={(data ?? []) as Hostel[]} defaultHostel={profile.hostel_id} />
    </div>
  );
}
