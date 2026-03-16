create table if not exists public.season_feedback_notes (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  season text not null,
  round integer not null check (round >= 1 and round <= 100),
  student_note text not null default '',
  admin_comment text not null default '',
  note_updated_at timestamptz,
  note_updated_by_role text check (note_updated_by_role in ('student', 'admin')),
  admin_comment_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, season, round)
);

create index if not exists season_feedback_notes_student_idx
  on public.season_feedback_notes (student_id, season, round);

create index if not exists season_feedback_notes_note_updated_idx
  on public.season_feedback_notes (note_updated_at desc);

alter table public.season_feedback_notes enable row level security;
revoke all on public.season_feedback_notes from anon, authenticated;
