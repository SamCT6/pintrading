-- Pinfolio setup/update migration. Safe to run in an existing project.
-- Run this entire file in Supabase SQL Editor while connected as the project owner.

create extension if not exists pgcrypto;

-- Profiles: one row per Auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text,
  bio text,
  avatar_url text,
  is_collection_public boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists is_collection_public boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- Normalize existing usernames and prevent case-only duplicates.
update public.profiles set username = lower(trim(username)) where username is not null and username <> lower(trim(username));
create unique index if not exists profiles_username_lower_unique on public.profiles (lower(username)) where username is not null;

create or replace function public.normalize_profile_username()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.username is not null then
    new.username := lower(trim(new.username));
    if new.username !~ '^[a-z0-9_.-]{2,30}$' then
      raise exception 'Username must be 2–30 characters and use only letters, numbers, periods, underscores, or hyphens.';
    end if;
  end if;
  if new.display_name is not null then new.display_name := trim(new.display_name); end if;
  return new;
end;
$$;
drop trigger if exists profiles_normalize_username on public.profiles;
create trigger profiles_normalize_username before insert or update of username, display_name on public.profiles
for each row execute function public.normalize_profile_username();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_name text; unique_name text;
begin
  base_name := lower(split_part(coalesce(new.email, 'pin-trader'), '@', 1));
  base_name := regexp_replace(base_name, '[^a-z0-9_.-]', '', 'g');
  if length(base_name) < 2 then base_name := 'pintrader'; end if;
  base_name := left(base_name, 30);
  insert into public.profiles (id, display_name, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'Pin Trader'), '@', 1)), base_name)
  on conflict do nothing;
  if not exists (select 1 from public.profiles where id = new.id) then
    unique_name := left(base_name, 20) || '_' || left(replace(new.id::text, '-', ''), 8);
    insert into public.profiles (id, display_name, username)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'Pin Trader'), '@', 1)), unique_name)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before this trigger was installed.
insert into public.profiles (id, display_name, username)
select u.id,
       coalesce(u.raw_user_meta_data->>'display_name', split_part(coalesce(u.email, 'Pin Trader'), '@', 1)),
       left(coalesce(nullif(regexp_replace(lower(split_part(coalesce(u.email, 'pintrader'), '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''), 'pintrader'), 20)
         || '_' || left(replace(u.id::text, '-', ''), 8)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
update public.profiles p set username = left(coalesce(nullif(regexp_replace(lower(split_part(coalesce(u.email, 'pintrader'), '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''), 'pintrader'), 20) || '_' || left(replace(u.id::text, '-', ''), 8)
from auth.users u where u.id = p.id and (p.username is null or trim(p.username) = '');

-- Core catalog and inventory tables.
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  character_name text,
  franchise text,
  park text,
  release_year integer,
  edition_type text,
  image_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.pins add column if not exists description text;
alter table public.pins add column if not exists character_name text;
alter table public.pins add column if not exists franchise text;
alter table public.pins add column if not exists park text;
alter table public.pins add column if not exists release_year integer;
alter table public.pins add column if not exists edition_type text;
alter table public.pins add column if not exists image_url text;
alter table public.pins add column if not exists image_path text;
alter table public.pins add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.pins add column if not exists created_at timestamptz not null default now();

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_id uuid not null references public.pins(id) on delete cascade,
  owned_quantity integer not null default 1 check (owned_quantity >= 0),
  tradeable_quantity integer not null default 0 check (tradeable_quantity >= 0),
  purchase_cost numeric(10,2),
  authenticity_status text not null default 'unknown',
  notes text,
  visibility text not null default 'private' check (visibility in ('private','friends','public')),
  photo_url text,
  photo_path text,
  created_at timestamptz not null default now(),
  unique (user_id, pin_id),
  check (tradeable_quantity <= owned_quantity)
);
alter table public.collection_items add column if not exists owned_quantity integer not null default 1;
alter table public.collection_items add column if not exists tradeable_quantity integer not null default 0;
alter table public.collection_items add column if not exists purchase_cost numeric(10,2);
alter table public.collection_items add column if not exists authenticity_status text not null default 'unknown';
alter table public.collection_items add column if not exists notes text;
alter table public.collection_items add column if not exists visibility text not null default 'private';
alter table public.collection_items add column if not exists photo_url text;
alter table public.collection_items add column if not exists photo_path text;
alter table public.collection_items add column if not exists created_at timestamptz not null default now();
create unique index if not exists collection_items_user_pin_unique on public.collection_items(user_id, pin_id);
-- Preserve photos uploaded by the earlier public-bucket prototype by converting their URLs
-- into private object paths; the frontend will request short-lived signed URLs for these paths.
update public.pins set image_path = substring(image_url from '/storage/v1/object/public/pin-images/(.*)$')
where image_path is null and image_url like '%/storage/v1/object/public/pin-images/%';
update public.collection_items set photo_path = substring(photo_url from '/storage/v1/object/public/pin-images/(.*)$')
where photo_path is null and photo_url like '%/storage/v1/object/public/pin-images/%';

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_id uuid not null references public.pins(id) on delete cascade,
  priority text not null default 'normal',
  target_price numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, pin_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create unique index if not exists friend_requests_pair_unique on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id)) where status in ('pending','accepted');

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  proposer_confirmed boolean not null default false,
  recipient_confirmed boolean not null default false,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposer_id <> recipient_id)
);
create table if not exists public.trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  pin_id uuid not null references public.pins(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  item_type text not null check (item_type in ('offered','requested')),
  created_at timestamptz not null default now()
);

-- Normalize status constraints for projects that already had early prototype tables.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.friend_requests'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.friend_requests drop constraint %I', c.conname);
  end loop;
  for c in select conname from pg_constraint where conrelid = 'public.trades'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.trades drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.friend_requests add constraint friend_requests_status_allowed check (status in ('pending','accepted','declined','cancelled'));
alter table public.trades add constraint trades_status_allowed check (status in ('pending','accepted','declined','cancelled','completed'));

create index if not exists collection_items_user_idx on public.collection_items(user_id);
create index if not exists wishlist_items_user_idx on public.wishlist_items(user_id);
create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id, status);
create index if not exists trades_participants_status_idx on public.trades(proposer_id, recipient_id, status);
create index if not exists trade_items_trade_idx on public.trade_items(trade_id);

-- Turn on RLS everywhere that contains user data.
alter table public.profiles enable row level security;
alter table public.pins enable row level security;
alter table public.collection_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.friend_requests enable row level security;
alter table public.trades enable row level security;
alter table public.trade_items enable row level security;

-- Remove older prototype policies on these app tables so permissive legacy policies cannot
-- accidentally override the rules below (Postgres combines permissive policies with OR).
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('profiles','pins','collection_items','wishlist_items','friend_requests','trades','trade_items')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Ensure existing tables also validate visibility and inventory counts.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='collection_items_visibility_allowed' and conrelid='public.collection_items'::regclass) then
    alter table public.collection_items add constraint collection_items_visibility_allowed check (visibility in ('private','friends','public')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='collection_items_tradeable_le_owned' and conrelid='public.collection_items'::regclass) then
    alter table public.collection_items add constraint collection_items_tradeable_le_owned check (tradeable_quantity <= owned_quantity) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='collection_items_quantities_nonnegative' and conrelid='public.collection_items'::regclass) then
    alter table public.collection_items add constraint collection_items_quantities_nonnegative check (owned_quantity >= 0 and tradeable_quantity >= 0) not valid;
  end if;
end $$;

-- Profiles are discoverable to signed-in users by username; users edit only their own profile.
drop policy if exists "Profiles visible to authenticated users" on public.profiles;
drop policy if exists "Users read own or discoverable profiles" on public.profiles;
create policy "Users read own or discoverable profiles" on public.profiles for select to authenticated using (
  id = auth.uid() OR is_collection_public = true OR exists (
    select 1 from public.friend_requests fr where fr.status = 'accepted'
      and ((fr.sender_id = auth.uid() and fr.receiver_id = profiles.id)
        or (fr.receiver_id = auth.uid() and fr.sender_id = profiles.id))
  )
);
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Catalog entries are readable to signed-in users; each user may create catalog pins.
drop policy if exists "Authenticated users read pin catalog" on public.pins;
create policy "Authenticated users read pin catalog" on public.pins for select to authenticated using (true);
drop policy if exists "Authenticated users create pins" on public.pins;
create policy "Authenticated users create pins" on public.pins for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Creators update their pins" on public.pins;
create policy "Creators update their pins" on public.pins for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- A user's own inventory is always visible to them. Other users only see rows that are
-- public or friends-shared and have an accepted friendship in either direction.
drop policy if exists "Users read own collection and shared listings" on public.collection_items;
drop policy if exists "Users read own collection" on public.collection_items;
create policy "Users read own collection" on public.collection_items for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users add to own collection" on public.collection_items;
create policy "Users add to own collection" on public.collection_items for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users update own collection" on public.collection_items;
create policy "Users update own collection" on public.collection_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users remove own collection items" on public.collection_items;
create policy "Users remove own collection items" on public.collection_items for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Users manage own wishlist" on public.wishlist_items;
create policy "Users manage own wishlist" on public.wishlist_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Participants read friend requests" on public.friend_requests;
create policy "Participants read friend requests" on public.friend_requests for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
drop policy if exists "Users send friend requests" on public.friend_requests;
create policy "Users send friend requests" on public.friend_requests for insert to authenticated with check (sender_id = auth.uid() and receiver_id <> auth.uid());
drop policy if exists "Receivers respond to friend requests" on public.friend_requests;
drop policy if exists "Senders cancel own friend requests" on public.friend_requests;
create policy "Senders cancel own friend requests" on public.friend_requests for delete to authenticated using (sender_id = auth.uid());

drop policy if exists "Trade participants read trades" on public.trades;
create policy "Trade participants read trades" on public.trades for select to authenticated using (proposer_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "Proposers create trades" on public.trades;
-- Trade rows are created only through create_trade_proposal(), which validates friendship and inventory.
drop policy if exists "Trade participants update trades" on public.trades;

drop policy if exists "Trade participants read trade items" on public.trade_items;
create policy "Trade participants read trade items" on public.trade_items for select to authenticated using (
  exists (select 1 from public.trades t where t.id = trade_items.trade_id and (t.proposer_id = auth.uid() or t.recipient_id = auth.uid()))
);
drop policy if exists "Proposers add trade items" on public.trade_items;

-- Decide who may create a signed URL for a private pin photo. Catalog images are shared;
-- personal collection photos are visible only to the owner or as allowed by that item's visibility.
create or replace function public.can_read_pin_image(p_object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.pins p where p.image_path = p_object_name)
    or exists (
      select 1 from public.collection_items ci
      where ci.photo_path = p_object_name and (
        ci.user_id = auth.uid() or ci.visibility = 'public' or (
          ci.visibility = 'friends' and exists (
            select 1 from public.friend_requests fr where fr.status = 'accepted'
              and ((fr.sender_id = auth.uid() and fr.receiver_id = ci.user_id)
                or (fr.receiver_id = auth.uid() and fr.sender_id = ci.user_id))
          )
        )
      )
    )
  );
$$;
revoke all on function public.can_read_pin_image(text) from public;
grant execute on function public.can_read_pin_image(text) to authenticated;

-- Private photo bucket: clients create short-lived signed URLs only when storage RLS allows it.
-- Uploads are restricted to a folder named for the authenticated user ID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pin-images', 'pin-images', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects'
    and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ilike '%pin-images%'
  loop execute format('drop policy if exists %I on storage.objects', p.policyname); end loop;
end $$;
drop policy if exists "Users read permitted pin images" on storage.objects;
create policy "Users read permitted pin images" on storage.objects for select to authenticated using (bucket_id = 'pin-images' and public.can_read_pin_image(name));
drop policy if exists "Users upload own pin images" on storage.objects;
create policy "Users upload own pin images" on storage.objects for insert to authenticated with check (bucket_id = 'pin-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update own pin images" on storage.objects;
create policy "Users update own pin images" on storage.objects for update to authenticated using (bucket_id = 'pin-images' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'pin-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own pin images" on storage.objects;
create policy "Users delete own pin images" on storage.objects for delete to authenticated using (bucket_id = 'pin-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Return only the minimum fields needed to browse a friend's shared trader listing.
-- Other users cannot SELECT the underlying collection_items rows directly.
create or replace function public.get_shared_trader_listings(p_user_ids uuid[] default null)
returns table (
  collection_item_id uuid, owner_id uuid, pin_id uuid, tradeable_quantity integer,
  visibility text, pin_name text, character_name text, franchise text, park text,
  release_year integer, image_url text, image_path text, username text, display_name text
) language sql stable security definer set search_path = public as $$
  select ci.id, ci.user_id, ci.pin_id, ci.tradeable_quantity, ci.visibility,
         p.name, p.character_name, p.franchise, p.park, p.release_year,
         coalesce(ci.photo_url, p.image_url), coalesce(ci.photo_path, p.image_path), pr.username, pr.display_name
  from public.collection_items ci
  join public.pins p on p.id = ci.pin_id
  join public.profiles pr on pr.id = ci.user_id
  where auth.uid() is not null
    and ci.tradeable_quantity > 0
    and ci.visibility in ('friends','public')
    and (p_user_ids is null or ci.user_id = any(p_user_ids))
    and (
      ci.visibility = 'public' or exists (
        select 1 from public.friend_requests fr
        where fr.status = 'accepted'
          and ((fr.sender_id = auth.uid() and fr.receiver_id = ci.user_id)
            or (fr.receiver_id = auth.uid() and fr.sender_id = ci.user_id))
      )
    );
$$;
revoke all on function public.get_shared_trader_listings(uuid[]) from public;
grant execute on function public.get_shared_trader_listings(uuid[]) to authenticated;

-- Friend request response is constrained to the receiving user.
create or replace function public.respond_to_friend_request(p_request_id uuid, p_response text)
returns text language plpgsql security definer set search_path = public as $$
declare req public.friend_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_response not in ('accepted','declined') then raise exception 'Invalid response.'; end if;
  select * into req from public.friend_requests where id = p_request_id for update;
  if not found or req.receiver_id <> auth.uid() then raise exception 'Friend request not found.'; end if;
  if req.status <> 'pending' then raise exception 'This friend request is no longer pending.'; end if;
  update public.friend_requests set status = p_response, updated_at = now() where id = p_request_id;
  return p_response;
end;
$$;
revoke all on function public.respond_to_friend_request(uuid,text) from public;
grant execute on function public.respond_to_friend_request(uuid,text) to authenticated;

-- Create a trade proposal only between accepted friends, with both sides' tradeable inventory validated.
create or replace function public.create_trade_proposal(
  p_recipient_id uuid, p_offer_pin_id uuid, p_offer_quantity integer,
  p_request_pin_id uuid, p_request_quantity integer, p_message text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_trade_id uuid; friendship boolean; proposer_stock public.collection_items%rowtype; recipient_stock public.collection_items%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_recipient_id = auth.uid() then raise exception 'You cannot trade with yourself.'; end if;
  if p_offer_quantity < 1 or p_request_quantity < 1 then raise exception 'Trade quantities must be at least one.'; end if;
  select exists(select 1 from public.friend_requests fr where fr.status='accepted' and ((fr.sender_id=auth.uid() and fr.receiver_id=p_recipient_id) or (fr.receiver_id=auth.uid() and fr.sender_id=p_recipient_id))) into friendship;
  if not friendship then raise exception 'You must be accepted friends to trade.'; end if;
  select * into proposer_stock from public.collection_items where user_id=auth.uid() and pin_id=p_offer_pin_id for update;
  if not found or proposer_stock.tradeable_quantity < p_offer_quantity then raise exception 'You do not have enough tradeable copies of the offered pin.'; end if;
  select * into recipient_stock from public.collection_items where user_id=p_recipient_id and pin_id=p_request_pin_id and visibility in ('friends','public') for update;
  if not found or recipient_stock.tradeable_quantity < p_request_quantity then raise exception 'That pin is not available to trade in the requested quantity.'; end if;
  insert into public.trades(proposer_id, recipient_id, message) values(auth.uid(), p_recipient_id, nullif(trim(p_message),'')) returning id into new_trade_id;
  insert into public.trade_items(trade_id, owner_id, pin_id, quantity, item_type) values
    (new_trade_id, auth.uid(), p_offer_pin_id, p_offer_quantity, 'offered'),
    (new_trade_id, p_recipient_id, p_request_pin_id, p_request_quantity, 'requested');
  return new_trade_id;
end;
$$;
revoke all on function public.create_trade_proposal(uuid,uuid,integer,uuid,integer,text) from public;
grant execute on function public.create_trade_proposal(uuid,uuid,integer,uuid,integer,text) to authenticated;

create or replace function public.respond_to_trade(p_trade_id uuid, p_response text)
returns text language plpgsql security definer set search_path = public as $$
declare tr public.trades%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_response not in ('accepted','declined') then raise exception 'Invalid response.'; end if;
  select * into tr from public.trades where id=p_trade_id for update;
  if not found or tr.recipient_id <> auth.uid() then raise exception 'Trade not found.'; end if;
  if tr.status <> 'pending' then raise exception 'This trade is no longer pending.'; end if;
  if p_response='accepted' then
    if exists(select 1 from public.trade_items ti left join public.collection_items ci on ci.user_id=ti.owner_id and ci.pin_id=ti.pin_id where ti.trade_id=tr.id and (ci.id is null or ci.tradeable_quantity < ti.quantity)) then
      raise exception 'One side no longer has enough tradeable pins. The proposal cannot be accepted.';
    end if;
  end if;
  update public.trades set status=p_response, updated_at=now() where id=tr.id;
  return p_response;
end;
$$;
revoke all on function public.respond_to_trade(uuid,text) from public;
grant execute on function public.respond_to_trade(uuid,text) to authenticated;

-- Each side confirms completion. Inventory transfer happens once, atomically, after both confirm.
create or replace function public.confirm_trade_completion(p_trade_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare tr public.trades%rowtype; ti record; new_owner uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select * into tr from public.trades where id=p_trade_id for update;
  if not found or (tr.proposer_id <> auth.uid() and tr.recipient_id <> auth.uid()) then raise exception 'Trade not found.'; end if;
  if tr.status <> 'accepted' then raise exception 'Only accepted trades can be completed.'; end if;
  if auth.uid()=tr.proposer_id then
    if tr.proposer_confirmed then return case when tr.recipient_confirmed then 'completed' else 'waiting' end; end if;
    update public.trades set proposer_confirmed=true, updated_at=now() where id=tr.id returning * into tr;
  else
    if tr.recipient_confirmed then return case when tr.proposer_confirmed then 'completed' else 'waiting' end; end if;
    update public.trades set recipient_confirmed=true, updated_at=now() where id=tr.id returning * into tr;
  end if;
  if not (tr.proposer_confirmed and tr.recipient_confirmed) then return 'waiting'; end if;

  if exists(select 1 from public.trade_items ti left join public.collection_items ci on ci.user_id=ti.owner_id and ci.pin_id=ti.pin_id where ti.trade_id=tr.id and (ci.id is null or ci.owned_quantity < ti.quantity or ci.tradeable_quantity < ti.quantity)) then
    raise exception 'Inventory changed since the proposal. Please cancel this trade and create a new one.';
  end if;

  for ti in select * from public.trade_items where trade_id=tr.id order by id loop
    new_owner := case when ti.owner_id=tr.proposer_id then tr.recipient_id else tr.proposer_id end;
    update public.collection_items set owned_quantity=owned_quantity-ti.quantity, tradeable_quantity=tradeable_quantity-ti.quantity
      where user_id=ti.owner_id and pin_id=ti.pin_id;
    delete from public.collection_items where user_id=ti.owner_id and pin_id=ti.pin_id and owned_quantity=0;
    insert into public.collection_items(user_id,pin_id,owned_quantity,tradeable_quantity,purchase_cost,authenticity_status,visibility)
      values(new_owner,ti.pin_id,ti.quantity,0,null,'unknown','private')
      on conflict(user_id,pin_id) do update set owned_quantity=public.collection_items.owned_quantity+excluded.owned_quantity;
  end loop;
  update public.trades set status='completed', updated_at=now() where id=tr.id;
  return 'completed';
end;
$$;
revoke all on function public.confirm_trade_completion(uuid) from public;
grant execute on function public.confirm_trade_completion(uuid) to authenticated;

-- Keep updated_at current for existing records as well as new changes.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at before update on public.friend_requests for each row execute function public.set_updated_at();
drop trigger if exists trades_set_updated_at on public.trades;
create trigger trades_set_updated_at before update on public.trades for each row execute function public.set_updated_at();

-- Required grants for normal authenticated app requests.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.collection_items, public.wishlist_items, public.friend_requests, public.trades, public.trade_items to authenticated;
grant select, insert, update on public.pins to authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
