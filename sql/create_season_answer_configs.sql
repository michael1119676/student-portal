create table if not exists public.season_answer_configs (
  id bigserial primary key,
  season text not null check (season in ('C', 'N')),
  round integer not null check (round >= 1 and round <= 30),
  question_count integer not null check (question_count > 0),
  answer_key jsonb not null default '[]'::jsonb,
  question_weights jsonb not null default '[]'::jsonb,
  score_mode text not null check (score_mode in ('percent100', 'weighted')),
  source_filename text,
  uploaded_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season, round)
);

create index if not exists idx_season_answer_configs_lookup
  on public.season_answer_configs (season, round);

alter table public.season_answer_configs enable row level security;
revoke all on public.season_answer_configs from anon, authenticated;
