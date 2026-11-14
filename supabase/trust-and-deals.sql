-- ReLoop — recorded deals, feedback, wanted board, privacy and rental reminders.
-- Run this AFTER schema.sql, in Supabase → SQL Editor → New query → Run.
-- It is safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Privacy: no room numbers at all, and the phone number moves out of the
--    table every signed-in student can read.
-- ---------------------------------------------------------------------------
create table if not exists public.profile_private (
  id    uuid primary key references public.profiles(id) on delete cascade,
  phone text
);
alter table public.profile_private enable row level security;

drop policy if exists "you read your own private details" on public.profile_private;
create policy "you read your own private details" on public.profile_private
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "you add your own private details" on public.profile_private;
create policy "you add your own private details" on public.profile_private
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "you change your own private details" on public.profile_private;
create policy "you change your own private details" on public.profile_private
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) then
    insert into public.profile_private (id, phone)
    select id, phone from public.profiles where phone is not null and phone <> ''
    on conflict (id) do nothing;
  end if;
end $$;

alter table public.profiles drop column if exists phone;
alter table public.profiles drop column if exists room_no;

-- ---------------------------------------------------------------------------
-- 2. Messages can be flagged as automatic (deal notices and reminders).
--    Students cannot set the flag themselves, so an automatic message is
--    always genuine.
-- ---------------------------------------------------------------------------
alter table public.messages add column if not exists is_auto boolean not null default false;

drop policy if exists "you send messages as yourself in your conversations" on public.messages;
create policy "you send messages as yourself in your conversations" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and is_auto = false
    and exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Deals: the record that two students actually exchanged something.
--    Created and changed only through the functions below.
-- ---------------------------------------------------------------------------
do $$ begin
  create type deal_kind as enum ('sale', 'rental', 'free');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_status as enum ('agreed', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.deals (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.conversations(id) on delete cascade,
  listing_id         uuid not null references public.listings(id) on delete cascade,
  seller_id          uuid not null references public.profiles(id) on delete cascade,
  buyer_id           uuid not null references public.profiles(id) on delete cascade,
  kind               deal_kind   not null,
  status             deal_status not null default 'agreed',
  amount             int not null default 0 check (amount >= 0 and amount <= 1000000),
  deposit            int not null default 0 check (deposit >= 0 and deposit <= 1000000),
  return_by          timestamptz,
  late_fee_per_day   int not null default 0 check (late_fee_per_day >= 0 and late_fee_per_day <= 100000),
  buyer_confirmed_at  timestamptz,
  seller_confirmed_at timestamptz,
  returned_at        timestamptz,
  late_fee_final     int,
  reminder_sent_at   timestamptz,
  overdue_notice_at  timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  check (kind <> 'rental' or return_by is not null)
);
create unique index if not exists deals_one_open_per_chat on public.deals (conversation_id) where status = 'agreed';
create index if not exists deals_status_idx on public.deals (status);
create index if not exists deals_open_rentals_idx on public.deals (return_by) where status = 'agreed' and kind = 'rental';

alter table public.deals enable row level security;

drop policy if exists "deals visible to their two people" on public.deals;
create policy "deals visible to their two people" on public.deals
  for select to authenticated using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.deals;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 4. Feedback: one grade and an optional comment per person per completed deal.
-- ---------------------------------------------------------------------------
do $$ begin
  create type review_grade as enum ('positive', 'neutral', 'negative');
exception when duplicate_object then null; end $$;

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  reviewer_id   uuid not null references public.profiles(id) on delete cascade,
  reviewee_id   uuid not null references public.profiles(id) on delete cascade,
  reviewee_role text not null check (reviewee_role in ('seller', 'buyer')),
  grade         review_grade not null,
  comment       text not null default '' check (char_length(comment) <= 500),
  created_at    timestamptz not null default now(),
  unique (deal_id, reviewer_id)
);
create index if not exists reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

alter table public.reviews enable row level security;

-- Reputation is public to signed-in students. There is no insert, update or
-- delete policy: reviews are written by submit_review() and never edited.
drop policy if exists "reviews readable by signed-in students" on public.reviews;
create policy "reviews readable by signed-in students" on public.reviews
  for select to authenticated using (true);

-- Totals only. This view runs as its owner so it can count deals you were not
-- part of, but it returns nothing except counts.
create or replace view public.user_stats as
select
  p.id as user_id,
  coalesce(r.positive, 0)  as positive,
  coalesce(r.neutral, 0)   as neutral,
  coalesce(r.negative, 0)  as negative,
  coalesce(d.completed, 0) as completed
from public.profiles p
left join (
  select reviewee_id,
         count(*) filter (where grade = 'positive') as positive,
         count(*) filter (where grade = 'neutral')  as neutral,
         count(*) filter (where grade = 'negative') as negative
    from public.reviews group by reviewee_id
) r on r.reviewee_id = p.id
left join (
  select uid, count(*) as completed from (
    select buyer_id as uid from public.deals where status = 'completed'
    union all
    select seller_id from public.deals where status = 'completed'
  ) x group by uid
) d on d.uid = p.id;

grant select on public.user_stats to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Late fees. Part of a day rounds up, the same rule as the rental price.
-- ---------------------------------------------------------------------------
create or replace function public.late_fee(p_return_by timestamptz, p_at timestamptz, p_per_day int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_return_by is null or p_at <= p_return_by then 0
    else (ceil(extract(epoch from (p_at - p_return_by)) / 86400.0))::int * greatest(p_per_day, 0)
  end
$$;

-- ---------------------------------------------------------------------------
-- 6. Deal functions. Every one checks who is calling.
-- ---------------------------------------------------------------------------

create or replace function public.create_deal(
  p_conversation uuid,
  p_kind         deal_kind,
  p_amount       int,
  p_return_by    timestamptz default null,
  p_late_fee     int default 0,
  p_deposit      int default 0
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c  public.conversations%rowtype;
  l  public.listings%rowtype;
  new_id uuid;
  note text;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into c from public.conversations where id = p_conversation;
  if not found or c.seller_id <> me then
    raise exception 'Only the person selling the item can record a deal.';
  end if;

  select * into l from public.listings where id = c.listing_id;
  if l.status <> 'active' then raise exception 'This listing is no longer active.'; end if;

  if exists (select 1 from public.deals where conversation_id = c.id and status = 'agreed') then
    raise exception 'There is already a deal in progress in this chat.';
  end if;

  if p_kind = 'sale' and l.mode not in ('sell', 'both') then
    raise exception 'This item is not for sale.';
  elsif p_kind = 'rental' and l.mode not in ('rent', 'both') then
    raise exception 'This item is not for rent.';
  elsif p_kind = 'free' and l.mode <> 'free' then
    raise exception 'This item is not being given away.';
  end if;

  if p_kind = 'rental' and (p_return_by is null or p_return_by <= now()) then
    raise exception 'Pick a return time in the future.';
  end if;

  insert into public.deals (
    conversation_id, listing_id, seller_id, buyer_id, kind, amount, deposit, return_by, late_fee_per_day
  ) values (
    c.id, c.listing_id, c.seller_id, c.buyer_id, p_kind,
    case when p_kind = 'free' then 0 else least(greatest(coalesce(p_amount, 0), 0), 1000000) end,
    case when p_kind = 'rental' then least(greatest(coalesce(p_deposit, 0), 0), 1000000) else 0 end,
    case when p_kind = 'rental' then p_return_by else null end,
    case when p_kind = 'rental' then least(greatest(coalesce(p_late_fee, 0), 0), 100000) else 0 end
  ) returning id into new_id;

  if p_kind = 'rental' then
    note := 'Rental agreed: "' || l.title || '" for ₹' || p_amount || ' plus ₹' || coalesce(p_deposit, 0)
         || ' deposit. Due back by ' || to_char(p_return_by at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM')
         || '. After that a late fee of ₹' || coalesce(p_late_fee, 0) || ' per day applies. '
         || 'I will send a reminder 6 hours before it is due.';
  elsif p_kind = 'free' then
    note := 'Agreed: "' || l.title || '" is yours. Both of us confirm below once it has been handed over.';
  else
    note := 'Deal recorded: "' || l.title || '" for ₹' || p_amount
         || '. Both of us confirm below once it has been handed over.';
  end if;

  insert into public.messages (conversation_id, sender_id, body, is_auto)
  values (c.id, me, note, true);

  return new_id;
end;
$$;

create or replace function public.confirm_handover(p_deal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d  public.deals%rowtype;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or me is null or me not in (d.buyer_id, d.seller_id) then
    raise exception 'That deal is not yours.';
  end if;
  if d.status <> 'agreed' then raise exception 'This deal is already closed.'; end if;
  if d.kind = 'rental' then
    raise exception 'A rental is complete when the item comes back.';
  end if;

  if me = d.buyer_id then
    update public.deals set buyer_confirmed_at = coalesce(buyer_confirmed_at, now()) where id = d.id;
  else
    update public.deals set seller_confirmed_at = coalesce(seller_confirmed_at, now()) where id = d.id;
  end if;

  select * into d from public.deals where id = p_deal;

  if d.buyer_confirmed_at is not null and d.seller_confirmed_at is not null then
    update public.deals set status = 'completed', completed_at = now() where id = d.id;
    update public.listings
       set status = case when d.kind = 'free' then 'given'::public.listing_status else 'sold'::public.listing_status end
     where id = d.listing_id;
    insert into public.messages (conversation_id, sender_id, body, is_auto)
    values (d.conversation_id, me, 'Handover confirmed by both of us. Deal complete — please leave feedback below.', true);
  else
    insert into public.messages (conversation_id, sender_id, body, is_auto)
    values (d.conversation_id, me, 'I have confirmed the handover. Waiting for the other side to confirm too.', true);
  end if;
end;
$$;

create or replace function public.mark_returned(p_deal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := auth.uid();
  d   public.deals%rowtype;
  fee int;
  note text;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or me is null or me <> d.seller_id then
    raise exception 'Only the owner can mark a rental as returned.';
  end if;
  if d.status <> 'agreed' or d.kind <> 'rental' then
    raise exception 'This is not an open rental.';
  end if;

  fee := public.late_fee(d.return_by, now(), d.late_fee_per_day);

  update public.deals
     set status = 'completed', returned_at = now(), completed_at = now(),
         late_fee_final = fee, seller_confirmed_at = now(), buyer_confirmed_at = coalesce(buyer_confirmed_at, now())
   where id = d.id;

  note := case when fee > 0
    then 'Item returned. It came back late, so the late fee is ₹' || fee || '. Please leave feedback below.'
    else 'Item returned on time. Deal complete — please leave feedback below.'
  end;
  insert into public.messages (conversation_id, sender_id, body, is_auto)
  values (d.conversation_id, me, note, true);
end;
$$;

create or replace function public.cancel_deal(p_deal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d  public.deals%rowtype;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or me is null or me not in (d.buyer_id, d.seller_id) then
    raise exception 'That deal is not yours.';
  end if;
  if d.status <> 'agreed' then raise exception 'This deal is already closed.'; end if;

  update public.deals set status = 'cancelled' where id = d.id;
  insert into public.messages (conversation_id, sender_id, body, is_auto)
  values (d.conversation_id, me, 'This deal has been cancelled.', true);
end;
$$;

create or replace function public.submit_review(p_deal uuid, p_grade review_grade, p_comment text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d  public.deals%rowtype;
  other uuid;
begin
  select * into d from public.deals where id = p_deal;
  if not found or me is null or me not in (d.buyer_id, d.seller_id) then
    raise exception 'You can only review someone you have dealt with.';
  end if;
  if d.status <> 'completed' then
    raise exception 'Feedback opens once the deal is complete.';
  end if;

  other := case when me = d.buyer_id then d.seller_id else d.buyer_id end;

  insert into public.reviews (deal_id, reviewer_id, reviewee_id, reviewee_role, grade, comment)
  values (
    d.id, me, other,
    case when me = d.buyer_id then 'seller' else 'buyer' end,
    p_grade,
    left(coalesce(trim(p_comment), ''), 500)
  );
exception when unique_violation then
  raise exception 'You have already left feedback for this deal.';
end;
$$;

-- The other person's phone number, and only once a deal exists between you.
create or replace function public.counterparty_phone(p_deal uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d  public.deals%rowtype;
  result text;
begin
  select * into d from public.deals where id = p_deal;
  if not found or me is null or me not in (d.buyer_id, d.seller_id) then return null; end if;
  if d.status not in ('agreed', 'completed') then return null; end if;

  select phone into result from public.profile_private
   where id = case when me = d.buyer_id then d.seller_id else d.buyer_id end;
  return nullif(result, '');
end;
$$;

-- The number shown on the home page.
create or replace function public.completed_deal_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.deals where status = 'completed'
$$;

-- ---------------------------------------------------------------------------
-- 7. Wanted board
-- ---------------------------------------------------------------------------
create table if not exists public.wanted_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 600),
  category    text not null default 'Other',
  max_budget  int check (max_budget is null or (max_budget > 0 and max_budget <= 1000000)),
  needed_by   date,
  hostel_id   text references public.hostels(id),
  status      text not null default 'open' check (status in ('open', 'fulfilled', 'closed')),
  created_at  timestamptz not null default now()
);
create index if not exists wanted_open_idx on public.wanted_posts (status, created_at desc);

alter table public.wanted_posts enable row level security;

drop policy if exists "open wanted posts are readable" on public.wanted_posts;
create policy "open wanted posts are readable" on public.wanted_posts
  for select to authenticated using (status = 'open' or author_id = (select auth.uid()));

drop policy if exists "you post wanted as yourself" on public.wanted_posts;
create policy "you post wanted as yourself" on public.wanted_posts
  for insert to authenticated with check (author_id = (select auth.uid()));

drop policy if exists "you edit only your wanted posts" on public.wanted_posts;
create policy "you edit only your wanted posts" on public.wanted_posts
  for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

drop policy if exists "you delete only your wanted posts" on public.wanted_posts;
create policy "you delete only your wanted posts" on public.wanted_posts
  for delete to authenticated using (author_id = (select auth.uid()));

-- Someone with the item answers a wanted post by offering one of their listings.
-- This opens the chat with the person who asked, which is the one case where the
-- seller starts the conversation.
create or replace function public.respond_to_wanted(p_wanted uuid, p_listing uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  w  public.wanted_posts%rowtype;
  l  public.listings%rowtype;
  convo uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into w from public.wanted_posts where id = p_wanted and status = 'open';
  if not found then raise exception 'That request is no longer open.'; end if;
  if w.author_id = me then raise exception 'That is your own request.'; end if;

  select * into l from public.listings where id = p_listing;
  if not found or l.seller_id <> me or l.status <> 'active' then
    raise exception 'Choose one of your own active listings.';
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (l.id, w.author_id, me)
  on conflict (listing_id, buyer_id) do update set last_at = now()
  returning id into convo;

  insert into public.messages (conversation_id, sender_id, body, is_auto)
  values (convo, me, 'I saw your request for "' || w.title || '". This might be what you need: "' || l.title || '".', true);

  return convo;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Rental reminders. Posts a message in the chat, from the owner, 6 hours
--    before a rental is due, then once a day while it is overdue.
-- ---------------------------------------------------------------------------
create or replace function public.send_rental_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  sent int := 0;
  fee int;
begin
  for d in
    select dl.*, li.title
      from public.deals dl
      join public.listings li on li.id = dl.listing_id
     where dl.kind = 'rental' and dl.status = 'agreed' and dl.returned_at is null
  loop
    if d.reminder_sent_at is null and now() >= d.return_by - interval '6 hours' and now() < d.return_by then
      insert into public.messages (conversation_id, sender_id, body, is_auto)
      values (
        d.conversation_id, d.seller_id,
        'Reminder: "' || d.title || '" is due back by '
          || to_char(d.return_by at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM')
          || '. Please return it on time — after that a late fee of ₹' || d.late_fee_per_day || ' per day applies.',
        true
      );
      update public.deals set reminder_sent_at = now() where id = d.id;
      sent := sent + 1;

    elsif now() >= d.return_by
      and (d.overdue_notice_at is null or d.overdue_notice_at <= now() - interval '24 hours') then
      fee := public.late_fee(d.return_by, now(), d.late_fee_per_day);
      insert into public.messages (conversation_id, sender_id, body, is_auto)
      values (
        d.conversation_id, d.seller_id,
        '"' || d.title || '" is now overdue. Late fee so far: ₹' || fee
          || ' (₹' || d.late_fee_per_day || ' per day). Please return it as soon as you can.',
        true
      );
      update public.deals
         set overdue_notice_at = now(), reminder_sent_at = coalesce(reminder_sent_at, now())
       where id = d.id;
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end;
$$;

-- Only the scheduler may run this; students cannot trigger reminders by hand.
revoke all on function public.send_rental_reminders() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'reloop-rental-reminders';
select cron.schedule('reloop-rental-reminders', '*/10 * * * *', $cron$select public.send_rental_reminders()$cron$);
