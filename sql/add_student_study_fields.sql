alter table public.students
  add column if not exists study_year text,
  add column if not exists study_place text;

comment on column public.students.study_year is '현역/재수/삼수/N수/군수';
comment on column public.students.study_place is '주로 공부하는 장소';
