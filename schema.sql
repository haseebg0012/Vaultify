-- Run this entire file once in Supabase → SQL Editor → New query → Run

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','saving','investment')),
  amount numeric not null,
  currency text not null,
  category text,
  holding_source text,
  note text,
  date date not null,
  created_at timestamptz default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  budget_limits jsonb default '{}'::jsonb,
  rates jsonb default '{}'::jsonb,
  rates_fetched_at timestamptz,
  display_currency text default 'PKR',
  last_currency text default 'PKR',
  updated_at timestamptz default now()
);

alter table public.entries enable row level security;
alter table public.settings enable row level security;

drop policy if exists "Users manage own entries" on public.entries;
create policy "Users manage own entries" on public.entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own settings" on public.settings;
create policy "Users manage own settings" on public.settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists entries_user_date_idx on public.entries (user_id, date desc);
