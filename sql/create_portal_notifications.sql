create table if not exists public.portal_notifications (
  id bigserial primary key,
  type text not null check (type in ('score_input', 'admin_comment', 'delivery_complete', 'announcement')),
  audience text not null default 'single' check (audience in ('single', 'all', 'students', 'admins')),
  target_user_id uuid references public.students(id) on delete cascade,
  title text not null,
  body text not null default '',
  is_important boolean not null default false,
  season text,
  round integer check (round is null or (round >= 1 and round <= 100)),
  related_path text,
  created_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((audience = 'single' and target_user_id is not null) or audience <> 'single')
);

create table if not exists public.portal_notification_reads (
  notification_id bigint not null references public.portal_notifications(id) on delete cascade,
  user_id uuid not null references public.students(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists idx_portal_notifications_created_at
  on public.portal_notifications (created_at desc);

create index if not exists idx_portal_notifications_target_user
  on public.portal_notifications (target_user_id, created_at desc);

create index if not exists idx_portal_notifications_audience
  on public.portal_notifications (audience, created_at desc);

create index if not exists idx_portal_notification_reads_user
  on public.portal_notification_reads (user_id, read_at desc);

alter table public.portal_notifications enable row level security;
alter table public.portal_notification_reads enable row level security;

revoke all on public.portal_notifications from anon, authenticated;
revoke all on public.portal_notification_reads from anon, authenticated;
