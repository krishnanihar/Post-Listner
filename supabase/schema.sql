-- migration: create_entries
-- purpose: journal entries for the desktop PostListener journal
-- affected tables: public.entries
-- special considerations: RLS enabled; each user reads/writes only their own rows

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  song text,        -- archetype + variation id (set by the rite, slice 3)
  summary text,     -- the Admirer's one-line commitEntry sentence
  glyph jsonb,      -- serialised gesture path (recorded, slice 3)
  region text       -- coarsened location for the collective (slice 5/6)
);

alter table public.entries enable row level security;

-- a user may read only their own entries
create policy "read own entries" on public.entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- a user may insert only entries attributed to themselves
create policy "insert own entries" on public.entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- the journal always queries one user's entries newest-first
create index if not exists entries_user_created_idx
  on public.entries (user_id, created_at desc);
