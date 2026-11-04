-- 읽어주기(Edge Function tts)의 남용 방지용 글자 수 제한.
-- Google 클라우드 TTS 무료 한도(Neural2 월 100만 자)를 두 사람이 나눠 쓰도록, 하루에 읽을 수 있는 글자 수를 서버가 센다.
-- 앱(anon/authenticated)은 이 표와 함수에 접근할 수 없고, Edge Function 이 service_role 로만 호출해요. 읽은 글 내용은 저장하지 않고 글자 수만 저장해요.
create table public.tts_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  chars int not null default 0,
  primary key (user_id, day)
);
alter table public.tts_usage enable row level security;
revoke all on public.tts_usage from public, anon, authenticated;

-- 오늘 쓴 글자 수에 p_chars 를 더하고 새 합계를 돌려준다. 한도를 넘게 되면 더하지 않고 -1.
create function public.take_tts_quota(p_user uuid, p_chars int, p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
  n int;
begin
  if p_chars <= 0 or p_chars > p_limit then return -1; end if;
  insert into public.tts_usage (user_id, day, chars) values (p_user, d, p_chars)
  on conflict (user_id, day) do update
    set chars = public.tts_usage.chars + p_chars
    where public.tts_usage.chars + p_chars <= p_limit
  returning chars into n;
  return coalesce(n, -1);
end $$;

revoke execute on function public.take_tts_quota(uuid, int, int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.take_tts_quota(uuid, int, int) to service_role;
  end if;
end $$;
