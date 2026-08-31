alter function public.get_ledger_dashboard(uuid,date,date) rename to get_ledger_dashboard_raw;
revoke all on function public.get_ledger_dashboard_raw(uuid,date,date) from public,anon,authenticated;

create function public.get_ledger_dashboard(p_book_id uuid,p_from date,p_to date)
returns jsonb
language sql stable security definer set search_path='' as $$
  with source as (
    select public.get_ledger_dashboard_raw(p_book_id,p_from,p_to) data
  ), fixed_merchants as (
    select coalesce(jsonb_agg(item||jsonb_build_object('average',split_part(item->>'average','.',1))),'[]'::jsonb) value
    from source cross join lateral jsonb_array_elements(data->'merchants') item
  ), fixed_recurring as (
    select coalesce(jsonb_agg(item||jsonb_build_object('average',split_part(item->>'average','.',1))),'[]'::jsonb) value
    from source cross join lateral jsonb_array_elements(data->'recurring') item
  )
  select jsonb_set(jsonb_set(source.data,'{merchants}',fixed_merchants.value),'{recurring}',fixed_recurring.value)
  from source,fixed_merchants,fixed_recurring;
$$;

revoke all on function public.get_ledger_dashboard(uuid,date,date) from public,anon;
grant execute on function public.get_ledger_dashboard(uuid,date,date) to authenticated;
comment on function public.get_ledger_dashboard(uuid,date,date) is 'Permission-checked ledger analytics with all monetary values serialized as integer strings.';
