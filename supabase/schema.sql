-- Kingsmen Academy Reaction Labs — Supabase schema.
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run (every statement is guarded), so don't worry about running it twice.
--
-- ALREADY RUN THIS ONCE BEFORE 2026-08-04? `create table if not exists` won't retroactively
-- fix an existing table's foreign keys, so run this once first (safe — records/runs are
-- still empty at this point, nothing to lose):
--
--   alter table public.records drop constraint if exists records_user_id_fkey;
--   alter table public.records add constraint records_user_id_fkey
--     foreign key (user_id) references public.profiles(id) on delete cascade;
--   alter table public.runs drop constraint if exists runs_user_id_fkey;
--   alter table public.runs add constraint runs_user_id_fkey
--     foreign key (user_id) references public.profiles(id) on delete cascade;
--
-- Then run the rest of this file as normal — the policy sections below also replace the
-- old "viewable by everyone" (anonymous-readable) policies with signed-in-only ones, so
-- re-running them takes care of that too. No separate step needed for that part.
--
-- Design note: `records` mirrors the app's local `ka_record_<key>` keyspace exactly —
-- same flat key/value shape, one row per (user, key). The rank tiers themselves are never
-- stored; they're computed client-side from these raw numbers every time a badge renders
-- (see js/core/shared.js), so recalibrating the rank ladders later needs no migration here.

-- ---------------------------------------------------------------------------------------
-- profiles — one row per signed-up user. Username defaults to the email's local part and
-- is public (needed to label rows on the global leaderboard).
-- ---------------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Readable only by signed-in players, not the wider internet. The anon key embedded in
-- the app is meant to be public, so "using (true)" here would let anyone holding it query
-- every player's data without ever creating an account — fine for a public leaderboard
-- later, not for now. auth.role() = 'authenticated' is what actually enforces that: it's
-- true only when the request carries a valid session, regardless of what the anon key is.
drop policy if exists "profiles are viewable by everyone" on public.profiles;
drop policy if exists "profiles are viewable by signed-in users" on public.profiles;
create policy "profiles are viewable by signed-in users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-creates a profile row the moment someone signs up, so the app never has to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------------------
-- records — the cloud mirror of KA_records. One row per (user, key); upserted on every
-- new personal best. Readable by any signed-in player (that's what powers the global
-- leaderboard) but not by an anonymous visitor, writable only by the row's own owner.
--
-- higher_is_better matters because "best" means different things per key: more correct
-- answers is better, but a lower average reaction time is better. The app tells this
-- table which direction applies at write time — see js/core/cloud.js.
-- ---------------------------------------------------------------------------------------
-- user_id references profiles, not auth.users, on purpose: PostgREST can only auto-embed
-- a joined table (profiles(username), in fetchLeaderboard) when there's a direct foreign
-- key to it. A shared FK to auth.users from both tables is not a path it can walk.
create table if not exists public.records (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  value numeric not null,
  higher_is_better boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.records enable row level security;

drop policy if exists "records are viewable by everyone" on public.records;
drop policy if exists "records are viewable by signed-in users" on public.records;
create policy "records are viewable by signed-in users"
  on public.records for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can insert own records" on public.records;
create policy "users can insert own records"
  on public.records for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update own records" on public.records;
create policy "users can update own records"
  on public.records for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------
-- runs — a private per-user activity log, mirroring the local KA_history feed. Not shown
-- to other users; it's a personal history, not leaderboard material.
-- ---------------------------------------------------------------------------------------
create table if not exists public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_name text not null,
  summary text not null,
  occurred_at timestamptz not null default now()
);

alter table public.runs enable row level security;

drop policy if exists "users can view own runs" on public.runs;
create policy "users can view own runs"
  on public.runs for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own runs" on public.runs;
create policy "users can insert own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

create index if not exists runs_user_id_occurred_at_idx
  on public.runs (user_id, occurred_at desc);

create index if not exists records_key_idx
  on public.records (key);
