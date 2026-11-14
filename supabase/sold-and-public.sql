-- ReLoop — "who did you sell it to?" and public browsing.
-- Run this AFTER schema.sql and trust-and-deals.sql, in Supabase → SQL Editor → Run.
-- It is safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Anyone can look at live listings without signing in, so a link shared on
--    WhatsApp shows the item. Nothing else opens up: no profiles, no feedback,
--    no chats, no phone numbers.
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can see live listings" on public.listings;
create policy "anyone can see live listings" on public.listings
  for select to anon using (status = 'active');

drop policy if exists "anyone can see hostels" on public.hostels;
create policy "anyone can see hostels" on public.hostels
  for select to anon using (true);

grant select on public.listings to anon;
grant select on public.hostels  to anon;

-- ---------------------------------------------------------------------------
-- 2. Marking an item sold or given away records WHO got it. The buyer has to be
--    someone who chatted with the seller about this very item.
-- ---------------------------------------------------------------------------
create or replace function public.sell_to(p_listing uuid, p_buyer uuid, p_amount int default 0)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := auth.uid();
  l   public.listings%rowtype;
  c   public.conversations%rowtype;
  k   public.deal_kind;
  amt int;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into l from public.listings where id = p_listing;
  if not found or l.seller_id <> me then
    raise exception 'Only the person selling the item can mark it sold.';
  end if;
  if l.status not in ('active', 'paused') then
    raise exception 'This listing is already closed.';
  end if;
  if l.mode not in ('sell', 'both', 'free') then
    raise exception 'This item is only for rent. Use Rent out instead.';
  end if;

  select * into c from public.conversations
   where listing_id = p_listing and seller_id = me and buyer_id = p_buyer;
  if not found then
    raise exception 'Pick someone you have chatted with about this item.';
  end if;

  if exists (select 1 from public.deals where conversation_id = c.id and status = 'agreed') then
    raise exception 'There is a deal in progress in that chat. Finish or cancel it first.';
  end if;

  k := case when l.mode = 'free' then 'free'::public.deal_kind else 'sale'::public.deal_kind end;
  amt := case when k = 'free' then 0 else least(greatest(coalesce(p_amount, 0), 0), 1000000) end;

  insert into public.deals (
    conversation_id, listing_id, seller_id, buyer_id, kind, status, amount,
    buyer_confirmed_at, seller_confirmed_at, completed_at
  ) values (
    c.id, l.id, l.seller_id, c.buyer_id, k, 'completed', amt, now(), now(), now()
  );

  update public.listings
     set status = case when k = 'free' then 'given'::public.listing_status else 'sold'::public.listing_status end
   where id = l.id;

  insert into public.messages (conversation_id, sender_id, body, is_auto)
  values (
    c.id, me,
    case when k = 'free'
      then '"' || l.title || '" has been given to you. Deal complete — please leave feedback below.'
      else '"' || l.title || '" is marked sold to you for ₹' || amt || '. Deal complete — please leave feedback below.'
    end,
    true
  );

  return c.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Renting out works the same way: pick the person from your chats. The
--    rental stays open until the owner marks it returned.
-- ---------------------------------------------------------------------------
create or replace function public.rent_to(
  p_listing   uuid,
  p_renter    uuid,
  p_amount    int,
  p_return_by timestamptz,
  p_late_fee  int default 0,
  p_deposit   int default 0
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c  public.conversations%rowtype;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into c from public.conversations
   where listing_id = p_listing and seller_id = me and buyer_id = p_renter;
  if not found then
    raise exception 'Pick someone you have chatted with about this item.';
  end if;

  perform public.create_deal(c.id, 'rental'::public.deal_kind, p_amount, p_return_by, p_late_fee, p_deposit);
  return c.id;
end;
$$;
