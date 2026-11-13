-- ReLoop — full database setup.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It is safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Only IIT Delhi addresses may hold an account.
-- ---------------------------------------------------------------------------
-- Anchored at the end, so iitd.ac.in.attacker.com is rejected. A LIKE '%iitd.ac.in%'
-- test would accept it. Sub-domains such as cse.iitd.ac.in are allowed.
create or replace function public.enforce_iitd_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or new.email !~* '@([a-z0-9-]+\.)*iitd\.ac\.in$' then
    raise exception 'ReLoop is open to IIT Delhi email addresses only (…@iitd.ac.in)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_iitd_domain_on_signup on auth.users;
create trigger enforce_iitd_domain_on_signup
  before insert on auth.users
  for each row execute function public.enforce_iitd_domain();

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.hostels (
  id          text primary key,
  name        text not null,
  zone        text not null,              -- groups neighbouring hostels: drives "a short walk"
  sort_order  int  not null default 0
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null default '',
  hostel_id    text references public.hostels(id),
  room_no      text,                      -- never exposed; kept for the owner only
  phone        text,                      -- revealed to a counterparty once a chat exists
  created_at   timestamptz not null default now()
);

do $$ begin
  create type listing_mode as enum ('sell', 'rent', 'both', 'free');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum ('active', 'paused', 'sold', 'given', 'removed');
exception when duplicate_object then null; end $$;

create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 80),
  category    text not null,
  description text not null default '',
  condition   text not null default 'Good',
  mode        listing_mode not null default 'sell',
  price       int  not null default 0 check (price >= 0),      -- whole rupees
  rate        int  not null default 0 check (rate  >= 0),      -- rent, per unit
  unit        text not null default 'day',                     -- day | week | month | semester
  deposit     int  not null default 0 check (deposit >= 0),
  hostel_id   text references public.hostels(id),
  pickup      text not null default '',
  attributes  jsonb not null default '{}'::jsonb,
  image_urls  text[] not null default '{}',
  status      listing_status not null default 'active',
  created_at  timestamptz not null default now()
);
create index if not exists listings_browse_idx on public.listings (status, created_at desc);
create index if not exists listings_seller_idx on public.listings (seller_id);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index if not exists conversations_buyer_idx  on public.conversations (buyer_id,  last_at desc);
create index if not exists conversations_seller_idx on public.conversations (seller_id, last_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  offer_amount    int,                    -- set when the message proposes a price
  created_at      timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages (conversation_id, created_at);

create table if not exists public.saved_items (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, listing_id)
);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  details     text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. A profile row is created automatically for every new account.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep a conversation's last_at in step with its newest message, so the chat
-- list orders correctly without the client writing it.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_sent on public.messages;
create trigger on_message_sent
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------------------------------------------------------------------------
-- 4. Row-level security. Ownership is enforced here, by the database, so a
--    hand-written API call cannot edit someone else's listing.
-- ---------------------------------------------------------------------------
alter table public.hostels       enable row level security;
alter table public.profiles      enable row level security;
alter table public.listings      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.saved_items   enable row level security;
alter table public.reports       enable row level security;

drop policy if exists "hostels are public" on public.hostels;
create policy "hostels are public" on public.hostels
  for select to authenticated using (true);

-- Everyone signed in can see who they are dealing with; only you edit your row.
drop policy if exists "profiles readable by signed-in students" on public.profiles;
create policy "profiles readable by signed-in students" on public.profiles
  for select to authenticated using (true);

drop policy if exists "you update only your own profile" on public.profiles;
create policy "you update only your own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "active listings are readable" on public.listings;
create policy "active listings are readable" on public.listings
  for select to authenticated using (status <> 'removed' or seller_id = (select auth.uid()));

drop policy if exists "you create listings as yourself" on public.listings;
create policy "you create listings as yourself" on public.listings
  for insert to authenticated with check (seller_id = (select auth.uid()));

drop policy if exists "you edit only your listings" on public.listings;
create policy "you edit only your listings" on public.listings
  for update to authenticated using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));

drop policy if exists "you delete only your listings" on public.listings;
create policy "you delete only your listings" on public.listings
  for delete to authenticated using (seller_id = (select auth.uid()));

drop policy if exists "conversations visible to their two people" on public.conversations;
create policy "conversations visible to their two people" on public.conversations
  for select to authenticated using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

-- The buyer opens the conversation; a seller cannot cold-message a student.
drop policy if exists "buyers open conversations" on public.conversations;
create policy "buyers open conversations" on public.conversations
  for insert to authenticated with check (
    buyer_id = (select auth.uid())
    and seller_id <> (select auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = seller_id)
  );

drop policy if exists "messages visible to their two people" on public.messages;
create policy "messages visible to their two people" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "you send messages as yourself in your conversations" on public.messages;
create policy "you send messages as yourself in your conversations" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "saved items are yours alone" on public.saved_items;
create policy "saved items are yours alone" on public.saved_items
  for all to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

drop policy if exists "you file your own reports" on public.reports;
create policy "you file your own reports" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

drop policy if exists "you see the reports you filed" on public.reports;
create policy "you see the reports you filed" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Photo storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "listing photos are public to read" on storage.objects;
create policy "listing photos are public to read" on storage.objects
  for select using (bucket_id = 'listing-photos');

-- Each student writes only inside a folder named after their own user id.
drop policy if exists "students upload to their own folder" on storage.objects;
create policy "students upload to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "students delete their own photos" on storage.objects;
create policy "students delete their own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 6. Live chat: let clients subscribe to new messages.
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 7. The hostels. Zones group neighbours, which is what "a short walk" means.
--    Check these against the real campus map before a pilot.
-- ---------------------------------------------------------------------------
insert into public.hostels (id, name, zone, sort_order) values
  ('aravali',     'Aravali',     'east',  1),
  ('karakoram',   'Karakoram',   'east',  2),
  ('jwalamukhi',  'Jwalamukhi',  'east',  3),
  ('kumaon',      'Kumaon',      'east',  4),
  ('nilgiri',     'Nilgiri',     'north', 5),
  ('satpura',     'Satpura',     'north', 6),
  ('vindhyachal', 'Vindhyachal', 'north', 7),
  ('zanskar',     'Zanskar',     'north', 8),
  ('girnar',      'Girnar',      'west',  9),
  ('himadri',     'Himadri',     'west',  10),
  ('kailash',     'Kailash',     'west',  11),
  ('shivalik',    'Shivalik',    'west',  12),
  ('udaigiri',    'Udaigiri',    'south', 13),
  ('dronagiri',   'Dronagiri',   'south', 14),
  ('saptagiri',   'Saptagiri',   'south', 15)
on conflict (id) do update set name = excluded.name, zone = excluded.zone, sort_order = excluded.sort_order;
