-- 두 사람만 쓰는 앱이라 초대 코드 없이 짝을 이어 준다.
-- 아직 짝이 없는 다른 사용자 중 가장 먼저 가입한 사람과 연결한다. 없으면 null(상대가 가입하길 기다리는 중).
-- 이미 짝이 있으면 그 연결의 id를 그대로 돌려준다.
-- 주의: 가입이 열려 있으면 모르는 사람이 먼저 가입해 짝이 될 수 있다. 두 사람이 모두 가입한 뒤에는
-- Supabase Auth 설정에서 신규 가입을 꺼 두는 것을 권한다.
create function public.connect_partner() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other uuid;
  fid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select id into fid from public.friendships where me in (user_a, user_b);
  if fid is not null then return fid; end if;
  select p.id into other from public.profiles p
    where p.id <> me
      and not exists (select 1 from public.friendships f where p.id in (f.user_a, f.user_b))
    order by p.created_at, p.id
    limit 1;
  if other is null then return null; end if;
  insert into public.friendships (user_a, user_b) values (least(me, other), greatest(me, other))
    returning id into fid;
  return fid;
end $$;

revoke execute on function public.connect_partner() from public, anon;
grant execute on function public.connect_partner() to authenticated;
