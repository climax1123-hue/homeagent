alter table public.goals
  add column priority text not null default 'medium'
  check (priority in ('low', 'medium', 'high'));

create index goals_household_priority_idx
  on public.goals (household_id, status, priority, target_date);

alter table public.ddays
  add column category text not null default 'other'
    check (category in ('birthday', 'anniversary', 'trip', 'event', 'other')),
  add column is_pinned boolean not null default false;

create index ddays_household_pinned_date_idx
  on public.ddays (household_id, is_pinned desc, target_date);

comment on column public.goals.priority is 'User-selected goal priority: low, medium, or high.';
comment on column public.ddays.category is 'Important-date category used for filtering and display.';
comment on column public.ddays.is_pinned is 'User-selected important item shown before other D-days.';
