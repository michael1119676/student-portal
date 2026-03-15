create table if not exists public.season_cutoffs (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  round integer not null,
  cut1 integer null check (cut1 >= 0 and cut1 <= 100),
  cut2 integer null check (cut2 >= 0 and cut2 <= 100),
  cut3 integer null check (cut3 >= 0 and cut3 <= 100),
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (season, round)
);

create index if not exists season_cutoffs_season_round_idx
  on public.season_cutoffs (season, round);

alter table public.season_cutoffs enable row level security;
