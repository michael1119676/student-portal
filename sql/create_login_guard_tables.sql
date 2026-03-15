create table if not exists public.login_guard_state (
  scope text not null check (scope in ('account', 'ip')),
  key text not null,
  student_id text,
  failed_count integer not null default 0,
  first_failed_at timestamptz,
  last_failed_at timestamptz,
  locked_until timestamptz,
  lock_reason text,
  unlocked_by text,
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (scope, key)
);

create index if not exists idx_login_guard_state_student_id
  on public.login_guard_state (student_id);

create index if not exists idx_login_guard_state_locked_until
  on public.login_guard_state (locked_until);

create table if not exists public.login_guard_events (
  id bigserial primary key,
  event_type text not null check (event_type in ('failed', 'locked', 'success', 'unlocked_by_admin')),
  scope text not null check (scope in ('account', 'ip')),
  key text not null,
  student_id text,
  ip text,
  name text,
  phone text,
  reason text,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_guard_events_created_at
  on public.login_guard_events (created_at desc);

create index if not exists idx_login_guard_events_student_id
  on public.login_guard_events (student_id);

alter table public.login_guard_state enable row level security;
alter table public.login_guard_events enable row level security;

revoke all on table public.login_guard_state from anon, authenticated;
revoke all on table public.login_guard_events from anon, authenticated;
