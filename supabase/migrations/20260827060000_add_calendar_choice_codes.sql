alter table public.common_codes disable trigger common_codes_validate;
alter table public.common_codes add column value_text text;

insert into public.common_codes(household_id,group_key,group_label,code,label,value_text,sort_order,is_system,is_admin_editable,created_by)
select h.id,s.group_key,s.group_label,s.code,s.label,s.value_text,s.sort_order,true,false,h.created_by
from public.households h cross join (values
('recurrence_end_mode','반복 종료 방식','never','종료 없음','never',10),('recurrence_end_mode','반복 종료 방식','until','종료일','until',20),('recurrence_end_mode','반복 종료 방식','count','횟수','count',30),
('calendar_reminder_minutes','일정 알림 시점','at_time','정시','0',10),('calendar_reminder_minutes','일정 알림 시점','before_10m','10분 전','10',20),('calendar_reminder_minutes','일정 알림 시점','before_30m','30분 전','30',30),('calendar_reminder_minutes','일정 알림 시점','before_1h','1시간 전','60',40),('calendar_reminder_minutes','일정 알림 시점','before_1d','1일 전','1440',50)
) s(group_key,group_label,code,label,value_text,sort_order)
on conflict (household_id,group_key,code) do nothing;

alter table public.common_codes enable trigger common_codes_validate;
