create table if not exists public.season_answer_responses (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  season text not null check (season in ('C', 'N')),
  round integer not null check (round >= 1 and round <= 30),
  student_name_snapshot text not null,
  student_phone_snapshot text not null,
  class_name_snapshot text,
  submitted_at timestamptz not null default now(),
  score integer,
  answers jsonb not null default '[]'::jsonb,
  source_type text not null,
  source_filename text,
  uploaded_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, season, round)
);

create index if not exists idx_season_answer_responses_lookup
  on public.season_answer_responses (season, round, student_id);

alter table public.season_answer_responses enable row level security;
revoke all on public.season_answer_responses from anon, authenticated;
