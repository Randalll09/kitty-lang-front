-- 초대 코드 연결을 다시 쓰기로 해서, 한 사람이 둘 이상과 이어지지 않도록 connect_with_code 를 보강한다.
-- 이미 다른 사람과 이어진 사람이 있으면(자동 연결로 이어진 경우 포함) 새 연결을 만들지 않는다.
-- 같은 사람끼리 이미 이어져 있으면 그 연결의 id를 그대로 돌려준다.
create or replace function public.connect_with_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other uuid;
  fid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select id into other from public.profiles where invite_code = upper(trim(p_code));
  if other is null then raise exception 'invalid invite code'; end if;
  if other = me then raise exception 'cannot connect with yourself'; end if;
  select id into fid from public.friendships
    where user_a = least(me, other) and user_b = greatest(me, other);
  if fid is not null then return fid; end if;
  if exists (select 1 from public.friendships where me in (user_a, user_b) or other in (user_a, user_b)) then
    raise exception 'already paired';
  end if;
  insert into public.friendships (user_a, user_b) values (least(me, other), greatest(me, other))
    returning id into fid;
  return fid;
end $$;
