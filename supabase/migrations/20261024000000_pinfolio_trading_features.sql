-- Pinfolio trading improvements: notifications, wishlist matches, and counteroffers.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  trade_id uuid references public.trades(id) on delete cascade,
  friend_request_id uuid references public.friend_requests(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on public.notifications to authenticated;

create or replace function public.notify_friend_request() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'pending' then
    insert into public.notifications(user_id, actor_id, kind, title, body, friend_request_id)
    values(new.receiver_id, new.sender_id, 'friend_request', 'New friend request', 'Someone wants to connect with you on Pinfolio.', new.id);
  end if;
  return new;
end; $$;
drop trigger if exists friend_request_notification on public.friend_requests;
create trigger friend_request_notification after insert on public.friend_requests for each row execute function public.notify_friend_request();

create or replace function public.notify_trade_change() returns trigger language plpgsql security definer set search_path=public as $$
declare target uuid; kind_value text; title_value text; body_value text;
begin
  if tg_op = 'INSERT' then
    target := new.recipient_id; kind_value := 'trade_proposal'; title_value := 'New trade proposal'; body_value := 'A trader sent you a proposal.';
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then kind_value := 'trade_accepted'; title_value := 'Trade accepted'; body_value := 'Your trade proposal was accepted.';
    elsif new.status = 'declined' then kind_value := 'trade_declined'; title_value := 'Trade declined'; body_value := 'A trade proposal was declined.';
    elsif new.status = 'completed' then kind_value := 'trade_completed'; title_value := 'Trade completed'; body_value := 'Both traders confirmed and inventory was transferred.';
    else return new; end if;
    target := case when auth.uid() = new.proposer_id then new.recipient_id else new.proposer_id end;
  else return new; end if;
  if target is not null and target <> auth.uid() then
    insert into public.notifications(user_id, actor_id, kind, title, body, trade_id) values(target, auth.uid(), kind_value, title_value, body_value, new.id);
  end if;
  return new;
end; $$;
drop trigger if exists trade_notification_insert on public.trades;
create trigger trade_notification_insert after insert on public.trades for each row execute function public.notify_trade_change();
drop trigger if exists trade_notification_update on public.trades;
create trigger trade_notification_update after update of status on public.trades for each row execute function public.notify_trade_change();

-- A counteroffer closes the old pending proposal and creates a new proposal in the opposite direction.
create or replace function public.counteroffer_trade(
  p_trade_id uuid, p_offer_pin_id uuid, p_offer_quantity integer,
  p_request_pin_id uuid, p_request_quantity integer, p_message text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare old_trade public.trades%rowtype; new_trade_id uuid; own_stock public.collection_items%rowtype; other_stock public.collection_items%rowtype; friendship boolean;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select * into old_trade from public.trades where id=p_trade_id for update;
  if not found or (auth.uid() <> old_trade.proposer_id and auth.uid() <> old_trade.recipient_id) then raise exception 'Trade not found.'; end if;
  if old_trade.status <> 'pending' then raise exception 'Only pending trades can be counteroffered.'; end if;
  if p_offer_quantity < 1 or p_request_quantity < 1 then raise exception 'Trade quantities must be at least one.'; end if;
  select exists(select 1 from public.friend_requests fr where fr.status='accepted' and ((fr.sender_id=auth.uid() and fr.receiver_id=case when auth.uid()=old_trade.proposer_id then old_trade.recipient_id else old_trade.proposer_id end) or (fr.receiver_id=auth.uid() and fr.sender_id=case when auth.uid()=old_trade.proposer_id then old_trade.recipient_id else old_trade.proposer_id end))) into friendship;
  if not friendship then raise exception 'You must still be friends to counteroffer.'; end if;
  select * into own_stock from public.collection_items where user_id=auth.uid() and pin_id=p_offer_pin_id for update;
  if not found or own_stock.tradeable_quantity < p_offer_quantity then raise exception 'You do not have enough tradeable copies of your offered pin.'; end if;
  select * into other_stock from public.collection_items where user_id=case when auth.uid()=old_trade.proposer_id then old_trade.recipient_id else old_trade.proposer_id end and pin_id=p_request_pin_id and visibility in ('friends','public') for update;
  if not found or other_stock.tradeable_quantity < p_request_quantity then raise exception 'The requested pin is not available in that quantity.'; end if;
  update public.trades set status='declined', updated_at=now() where id=old_trade.id;
  insert into public.trades(proposer_id,recipient_id,message) values(auth.uid(), case when auth.uid()=old_trade.proposer_id then old_trade.recipient_id else old_trade.proposer_id end, coalesce(nullif(trim(p_message),''),'Counteroffer')) returning id into new_trade_id;
  insert into public.trade_items(trade_id,owner_id,pin_id,quantity,item_type) values
    (new_trade_id,auth.uid(),p_offer_pin_id,p_offer_quantity,'offered'),
    (new_trade_id,case when auth.uid()=old_trade.proposer_id then old_trade.recipient_id else old_trade.proposer_id end,p_request_pin_id,p_request_quantity,'requested');
  return new_trade_id;
end; $$;
revoke all on function public.counteroffer_trade(uuid,uuid,integer,uuid,integer,text) from public;
grant execute on function public.counteroffer_trade(uuid,uuid,integer,uuid,integer,text) to authenticated;

-- Return wishlist matches among friends' shareable, tradeable listings.
create or replace function public.get_friend_wishlist_matches() returns table(
  owner_id uuid, username text, display_name text, pin_id uuid, pin_name text,
  franchise text, park text, image_url text, tradeable_quantity integer, priority text
) language sql stable security definer set search_path=public as $$
  select ci.user_id, p.username, p.display_name, wi.pin_id, pins.name, pins.franchise, pins.park,
         pins.image_url, ci.tradeable_quantity, wi.priority
  from public.friend_requests fr
  join public.profiles p on p.id = case when fr.sender_id=auth.uid() then fr.receiver_id else fr.sender_id end
  join public.collection_items ci on ci.user_id=p.id and ci.visibility in ('friends','public') and ci.tradeable_quantity > 0
  join public.pins on pins.id=ci.pin_id
  join public.wishlist_items wi on wi.user_id=auth.uid() and wi.pin_id=ci.pin_id
  where fr.status='accepted' and auth.uid() in (fr.sender_id,fr.receiver_id)
  order by case wi.priority when 'high' then 1 when 'urgent' then 1 when 'normal' then 2 else 3 end, pins.name;
$$;
revoke all on function public.get_friend_wishlist_matches() from public;
grant execute on function public.get_friend_wishlist_matches() to authenticated;
