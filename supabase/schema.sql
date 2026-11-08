-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Row level security is on for every table: a signed-in user can only read their own rows.
-- Orders and passes are written only by the server (secret key), never by the browser.

create table if not exists public.orders (
  order_id   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  plan       text not null check (plan in ('week', 'month', 'year')),
  amount     numeric(10, 2) not null check (amount > 0),
  status     text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists public.passes (
  order_id    text primary key references public.orders on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  plan        text not null,
  valid_until timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists passes_user_idx on public.passes (user_id, valid_until desc);

create table if not exists public.trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title      text not null check (char_length(title) <= 80),
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists trips_user_idx on public.trips (user_id, created_at desc);

alter table public.orders enable row level security;
alter table public.passes enable row level security;
alter table public.trips  enable row level security;

drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "read own passes" on public.passes;
create policy "read own passes" on public.passes for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own trips" on public.trips;
create policy "own trips" on public.trips for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
