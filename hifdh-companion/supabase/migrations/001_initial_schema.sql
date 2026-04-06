-- Hifdh Companion: Initial Schema
-- Run this in Supabase SQL editor

-- Enable RLS
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- Memorized verses table
create table if not exists public.memorized_verses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  surah_number integer not null check (surah_number between 1 and 114),
  verse_number integer not null check (verse_number >= 1),
  page_number integer not null default 0,
  memorized_at timestamptz default now() not null,
  next_review_date timestamptz default now() not null,
  review_count integer default 0 not null,
  retention_strength numeric(3,2) default 0.50 not null,
  last_performance text,
  interval_days integer default 1 not null,

  unique(user_id, surah_number, verse_number)
);

-- Review history table
create table if not exists public.review_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  verse_id uuid references public.memorized_verses(id) on delete cascade not null,
  reviewed_at timestamptz default now() not null,
  performance text not null check (performance in ('forgot', 'hard', 'good', 'easy')),
  interval_days integer not null
);

-- Indexes
create index if not exists idx_memorized_user on public.memorized_verses(user_id);
create index if not exists idx_memorized_review_date on public.memorized_verses(user_id, next_review_date);
create index if not exists idx_review_history_user on public.review_history(user_id);
create index if not exists idx_review_history_verse on public.review_history(verse_id);

-- Row Level Security
alter table public.memorized_verses enable row level security;
alter table public.review_history enable row level security;

-- Policies: users can only access their own data
create policy "Users can view own memorized verses"
  on public.memorized_verses for select
  using (auth.uid() = user_id);

create policy "Users can insert own memorized verses"
  on public.memorized_verses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own memorized verses"
  on public.memorized_verses for update
  using (auth.uid() = user_id);

create policy "Users can delete own memorized verses"
  on public.memorized_verses for delete
  using (auth.uid() = user_id);

create policy "Users can view own review history"
  on public.review_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own review history"
  on public.review_history for insert
  with check (auth.uid() = user_id);
