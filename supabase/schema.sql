-- ============================================================================
-- CalBingo — Supabase schema
-- Run once in your project's SQL editor (Dashboard → SQL Editor → New query).
-- Turns on host-run sessions, durable cross-device saves, and the live
-- leaderboard. Safe to re-run: every statement is guarded with IF NOT EXISTS
-- / DROP-then-CREATE.
-- ============================================================================

-- A host-run event room. `code` is the short human code players type / scan.
create table if not exists sessions (
  code        text primary key,
  title       text,
  created_at  timestamptz default now(),
  active      boolean default true
);

-- One row per player per session — their whole card lives in `card` (jsonb).
-- `name` is the display name; `name_key` is its lowercased/trimmed form and is
-- the identity: re-joining with the same name (any casing) in the same session
-- restores that player's card instead of dealing a new one.
create table if not exists players (
  id           uuid primary key default gen_random_uuid(),
  session_code text references sessions(code) on delete cascade,
  name         text not null,
  name_key     text not null,
  card         jsonb not null,          -- { order, marked, names, quizzesSeen }
  mark_count   int  default 0,          -- denormalized so the leaderboard sorts cheaply
  has_won      boolean default false,
  won_at       timestamptz,
  updated_at   timestamptz default now(),
  unique (session_code, name_key)       -- the resume key
);

-- Broadcast row changes so the host leaderboard updates in real time.
-- (Guarded — adding a table already in the publication would otherwise error.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table players;
  end if;
end $$;

-- Row-Level Security. This is an honor-system party game with non-sensitive
-- data (names + which squares got marked), so we let the anonymous public key
-- read and write these two tables — and nothing else in your project.
alter table sessions enable row level security;
alter table players  enable row level security;

drop policy if exists "anon all sessions" on sessions;
drop policy if exists "anon all players"  on players;
create policy "anon all sessions" on sessions for all to anon using (true) with check (true);
create policy "anon all players"  on players  for all to anon using (true) with check (true);
