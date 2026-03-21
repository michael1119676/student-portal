alter table public.students
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.students(id) on delete set null;

update public.students
set is_deleted = false
where is_deleted is distinct from false;
