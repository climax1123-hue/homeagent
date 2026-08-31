create or replace function public.get_ledger_dashboard(
  p_book_id uuid,
  p_from date,
  p_to date
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_days integer;
  v_previous_from date;
  v_previous_to date;
  v_result jsonb;
begin
  if auth.uid() is null or not private.can_read_ledger_book(p_book_id) then
    raise exception 'LEDGER_DASHBOARD_ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'LEDGER_DASHBOARD_RANGE_INVALID' using errcode = '22023';
  end if;
  v_days := p_to - p_from + 1;
  if v_days > 731 then
    raise exception 'LEDGER_DASHBOARD_RANGE_TOO_LARGE' using errcode = '22023';
  end if;
  v_previous_to := p_from - 1;
  v_previous_from := v_previous_to - v_days + 1;

  with all_rows as (
    select t.*, (t.occurred_at at time zone 'Asia/Seoul')::date as local_date
    from public.ledger_transactions t
    where t.book_id = p_book_id and t.deleted_at is null and t.type <> 'transfer'
      and t.occurred_at >= (v_previous_from::timestamp at time zone 'Asia/Seoul')
      and t.occurred_at < ((p_to + 1)::timestamp at time zone 'Asia/Seoul')
  ), current_rows as (
    select * from all_rows where local_date between p_from and p_to
  ), previous_rows as (
    select * from all_rows where local_date between v_previous_from and v_previous_to
  ), summary as (
    select coalesce(sum(amount) filter(where type='income'),0)::text income,
      coalesce(sum(amount) filter(where type='expense'),0)::text expense,
      (coalesce(sum(amount) filter(where type='income'),0)-coalesce(sum(amount) filter(where type='expense'),0))::text net,
      count(*)::int transaction_count, count(*) filter(where type='expense')::int expense_count,
      count(distinct local_date)::int active_days from current_rows
  ), previous_summary as (
    select coalesce(sum(amount) filter(where type='income'),0)::text income,
      coalesce(sum(amount) filter(where type='expense'),0)::text expense,
      (coalesce(sum(amount) filter(where type='income'),0)-coalesce(sum(amount) filter(where type='expense'),0))::text net,
      count(*)::int transaction_count, count(*) filter(where type='expense')::int expense_count,
      count(distinct local_date)::int active_days from previous_rows
  ), months as (
    select to_char(date_trunc('month', local_date),'YYYY-MM') period,
      coalesce(sum(amount) filter(where type='income'),0)::text income,
      coalesce(sum(amount) filter(where type='expense'),0)::text expense,
      (coalesce(sum(amount) filter(where type='income'),0)-coalesce(sum(amount) filter(where type='expense'),0))::text net
    from current_rows group by 1 order by 1
  ), category_current as (
    select category_id, coalesce(c.name,'미분류') name, coalesce(c.color,'gray') color,
      sum(r.amount) amount, count(*)::int count
    from current_rows r left join public.ledger_categories c on c.id=r.category_id
    where r.type='expense' group by category_id,c.name,c.color
  ), category_previous as (
    select category_id, sum(amount) amount from previous_rows where type='expense' group by category_id
  ), categories as (
    select coalesce(cc.category_id::text,'uncategorized') id,cc.name,cc.color,cc.amount::text amount,cc.count,
      coalesce(cp.amount,0)::text previous_amount from category_current cc
    left join category_previous cp on cp.category_id is not distinct from cc.category_id order by cc.amount desc
  ), accounts as (
    select a.id::text id,a.name,sum(r.amount)::text amount,count(*)::int count
    from current_rows r join public.ledger_accounts a on a.id=r.account_id
    where r.type='expense' group by a.id,a.name order by sum(r.amount) desc
  ), members as (
    select m.user_id::text id,m.display_name name,sum(r.amount)::text amount,count(*)::int count
    from current_rows r join public.household_members m on m.household_id=r.household_id and m.user_id=r.payer_user_id
    where r.type='expense' group by m.user_id,m.display_name order by sum(r.amount) desc
  ), weekdays as (
    select extract(isodow from local_date)::int weekday,
      (array['월','화','수','목','금','토','일'])[extract(isodow from local_date)::int] name,
      sum(amount)::text amount,count(*)::int count from current_rows where type='expense'
    group by 1,2 order by 1
  ), days as (
    select local_date::text date,coalesce(sum(amount) filter(where type='income'),0)::text income,
      coalesce(sum(amount) filter(where type='expense'),0)::text expense
    from current_rows group by local_date order by local_date
  ), merchants as (
    select lower(merchant) id,merchant name,sum(amount)::text amount,count(*)::int count,
      (sum(amount)/count(*))::text average from current_rows
    where type='expense' and merchant<>'' group by lower(merchant),merchant order by sum(amount) desc limit 10
  ), recurring as (
    select lower(merchant) id,merchant name,sum(amount)::text amount,count(*)::int count,
      count(distinct date_trunc('month',local_date))::int months,(sum(amount)/count(*))::text average
    from current_rows where type='expense' and merchant<>''
    group by lower(merchant),merchant having count(distinct date_trunc('month',local_date))>=2
    order by sum(amount) desc limit 10
  )
  select jsonb_build_object(
    'summary',(select jsonb_build_object('incomeTotal',income,'expenseTotal',expense,'netTotal',net,'transactionCount',transaction_count,'expenseTransactionCount',expense_count,'activeDays',active_days) from summary),
    'previousSummary',(select jsonb_build_object('incomeTotal',income,'expenseTotal',expense,'netTotal',net,'transactionCount',transaction_count,'expenseTransactionCount',expense_count,'activeDays',active_days) from previous_summary),
    'monthly',coalesce((select jsonb_agg(jsonb_build_object('period',period,'income',income,'expense',expense,'net',net) order by period) from months),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'amount',amount,'count',count,'previousAmount',previous_amount)) from categories),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'amount',amount,'count',count)) from accounts),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'amount',amount,'count',count)) from members),'[]'::jsonb),
    'weekdays',coalesce((select jsonb_agg(jsonb_build_object('id',weekday::text,'weekday',weekday,'name',name,'amount',amount,'count',count)) from weekdays),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',date,'income',income,'expense',expense)) from days),'[]'::jsonb),
    'merchants',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'amount',amount,'count',count,'average',average)) from merchants),'[]'::jsonb),
    'recurring',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'amount',amount,'count',count,'months',months,'average',average)) from recurring),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_ledger_dashboard(uuid,date,date) from public, anon;
grant execute on function public.get_ledger_dashboard(uuid,date,date) to authenticated;
comment on function public.get_ledger_dashboard(uuid,date,date) is 'Permission-checked ledger analytics for a Seoul-local date range.';
