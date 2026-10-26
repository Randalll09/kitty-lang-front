-- "밑줄 질문"(Edge Function ask)의 남용 방지용 호출 제한.
-- 하루 호출 횟수와 연속 호출 간격을 서버가 센다. 앱(anon/authenticated)은 이 표와 함수에 접근할 수 없고,
-- Edge Function 이 service_role 로만 호출해요. 질문 내용은 저장하지 않고 횟수만 저장해요.
create table public.ask_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  last_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.ask_usage enable row level security;
revoke all on public.ask_usage from public, anon, authenticated;

-- 새 호출 횟수를 돌려준다. 오늘 한도에 닿았으면 -1, 직전 호출과 너무 가까우면 -2 (횟수는 올리지 않는다).
create function public.take_ask_quota(p_user uuid, p_limit int, p_gap_seconds int default 2)
returns int language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
  n int;
  cur public.ask_usage;
begin
  insert into public.ask_usage (user_id, day, count, last_at) values (p_user, d, 1, now())
  on conflict (user_id, day) do update
    set count = public.ask_usage.count + 1, last_at = now()
    where public.ask_usage.count < p_limit
      and public.ask_usage.last_at <= now() - make_interval(secs => p_gap_seconds)
  returning count into n;
  if n is not null then return n; end if;
  select * into cur from public.ask_usage where user_id = p_user and day = d;
  return case when cur.count >= p_limit then -1 else -2 end;
end $$;

revoke execute on function public.take_ask_quota(uuid, int, int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.take_ask_quota(uuid, int, int) to service_role;
  end if;
end $$;
