import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SellForm from '@/app/(app)/sell/form';
import type { Hostel, Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  const listing = data as Listing | null;
  if (!listing) notFound();
  if (listing.seller_id !== user.id) redirect(`/listing/${id}`);

  const { data: hostels } = await supabase.from('hostels').select('*').order('sort_order');

  return (
    <div className="page">
      <div className="page-head">
        <h1>Edit listing</h1>
        <p>Change anything you like. Photos, price and pickup details update straight away.</p>
      </div>
      <SellForm
        hostels={(hostels ?? []) as Hostel[]}
        defaultHostel={null}
        listingId={listing.id}
        initial={{
          title: listing.title,
          category: listing.category,
          description: listing.description,
          condition: listing.condition,
          mode: listing.mode,
          price: listing.price,
          rate: listing.rate,
          unit: listing.unit,
          deposit: listing.deposit,
          hostel_id: listing.hostel_id,
          pickup: listing.pickup,
          attributes: listing.attributes ?? {},
          image_urls: listing.image_urls,
        }}
      />
    </div>
  );
}
