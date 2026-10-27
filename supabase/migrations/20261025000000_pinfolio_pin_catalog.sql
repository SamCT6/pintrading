-- Pinfolio shared pin catalog and set tracking.
-- Run after the existing core and trading-features migrations.

create table if not exists public.pin_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  franchise text,
  release_year integer,
  image_url text,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists pin_sets_name_lower_unique on public.pin_sets (lower(name));

alter table public.pins add column if not exists catalog_code text;
alter table public.pins add column if not exists pin_set_id uuid references public.pin_sets(id) on delete set null;
alter table public.pins add column if not exists set_number text;
alter table public.pins add column if not exists is_catalog boolean not null default false;
create unique index if not exists pins_catalog_code_unique on public.pins(catalog_code) where catalog_code is not null;
create index if not exists pins_pin_set_id_idx on public.pins(pin_set_id);

alter table public.pin_sets enable row level security;
drop policy if exists "Authenticated users read pin sets" on public.pin_sets;
create policy "Authenticated users read pin sets" on public.pin_sets for select to authenticated using (true);
drop policy if exists "Authenticated users create pin sets" on public.pin_sets;
create policy "Authenticated users create pin sets" on public.pin_sets for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Creators update pin sets" on public.pin_sets;
create policy "Creators update pin sets" on public.pin_sets for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "Creators delete pin sets" on public.pin_sets;
create policy "Creators delete pin sets" on public.pin_sets for delete to authenticated using (created_by = auth.uid());

grant select, insert, update, delete on public.pin_sets to authenticated;
grant select, insert, update on public.pins to authenticated;
