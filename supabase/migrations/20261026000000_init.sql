-- 언어 앱 기본 백엔드 (Supabase / Postgres)
-- 원칙: 숫자만 저장한다. 글 제목, 단어 내용, 퀴즈 문항은 서버에 두지 않는다.

create extension if not exists pgcrypto;

-- ───────── 프로필 ─────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 20),
  learning_language text not null default 'ja' check (learning_language in ('ja', 'en')),
  -- 친구가 입력해서 연결하는 초대 코드
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

-- 가입하면 프로필을 자동으로 만든다.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────── 친구 연결 (두 사람 한 쌍) ─────────
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create function public.are_friends(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() in (p_a, p_b) and exists (
    select 1 from public.friendships
    where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b)
  );
$$;

-- 초대 코드로 친구 연결. 이미 연결돼 있으면 그대로 돌려준다.
create function public.connect_with_code(p_code text) returns uuid
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
  insert into public.friendships (user_a, user_b)
    values (least(me, other), greatest(me, other))
    on conflict (user_a, user_b) do nothing;
  select id into fid from public.friendships
    where user_a = least(me, other) and user_b = greatest(me, other);
  return fid;
end $$;

-- ───────── 일별 학습 기록 ─────────
create table public.daily_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  language text not null check (language in ('ja', 'en')),
  study_seconds int not null default 0 check (study_seconds >= 0),
  articles_read int not null default 0 check (articles_read >= 0),
  words_reviewed int not null default 0 check (words_reviewed >= 0),
  quiz_correct int not null default 0 check (quiz_correct >= 0),
  quiz_total int not null default 0 check (quiz_total >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, language),
  check (quiz_correct <= quiz_total)
);

create index daily_progress_user_day on public.daily_progress (user_id, day desc);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger daily_progress_touch
  before update on public.daily_progress
  for each row execute function public.touch_updated_at();

-- 연속 일수: 오늘(없으면 어제)부터 이어진 학습일 수. stats_for 안에서만 쓴다.
create function public.current_streak(p_user uuid, p_today date default current_date) returns int
language sql stable security definer set search_path = public as $$
  with days as (
    select distinct day from public.daily_progress
    where user_id = p_user and study_seconds > 0 and day <= p_today
  ),
  runs as (
    select day, day - (row_number() over (order by day))::int as grp from days
  )
  select coalesce((
    select count(*)::int from runs
    where grp = (select grp from runs where day >= p_today - 1 order by day desc limit 1)
  ), 0);
$$;

-- 나와 친구의 기간별 합계/정답률/연속 일수. 친구가 아닌 사람은 볼 수 없다.
create function public.stats_for(p_user uuid, p_from date, p_to date)
returns table (
  user_id uuid, study_seconds bigint, articles_read bigint, words_reviewed bigint,
  quiz_correct bigint, quiz_total bigint, accuracy numeric, streak int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is distinct from auth.uid() and not public.are_friends(auth.uid(), p_user) then
    return;
  end if;
  return query
    select p_user,
           coalesce(sum(d.study_seconds), 0)::bigint, coalesce(sum(d.articles_read), 0)::bigint,
           coalesce(sum(d.words_reviewed), 0)::bigint, coalesce(sum(d.quiz_correct), 0)::bigint,
           coalesce(sum(d.quiz_total), 0)::bigint,
           case when coalesce(sum(d.quiz_total), 0) = 0 then null
                else round(sum(d.quiz_correct)::numeric / sum(d.quiz_total), 3) end,
           public.current_streak(p_user)
    from public.daily_progress d
    where d.user_id = p_user and d.day between p_from and p_to;
end $$;

-- ───────── 응원(알림) ─────────
create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  -- 미리 정한 응원 종류만 허용 (자유 텍스트 없음)
  kind text not null default 'cheer' check (kind in ('cheer', 'nudge', 'congrats')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (from_user <> to_user)
);

create index cheers_to_user on public.cheers (to_user, created_at desc);

-- 같은 사람에게 하루 20번까지만 보낼 수 있다.
create function public.limit_cheers() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.cheers
      where from_user = new.from_user and to_user = new.to_user
        and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many cheers today';
  end if;
  return new;
end $$;

create trigger cheers_limit before insert on public.cheers
  for each row execute function public.limit_cheers();

-- ───────── 공동 목표 ─────────
create table public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null references public.friendships (id) on delete cascade,
  metric text not null check (metric in ('study_seconds', 'articles_read', 'words_reviewed')),
  target int not null check (target > 0),
  start_day date not null,
  end_day date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (end_day >= start_day)
);

-- 두 사람의 합계가 목표를 향해 얼마나 왔는지.
create function public.goal_progress(p_goal uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case g.metric
           when 'study_seconds' then d.study_seconds
           when 'articles_read' then d.articles_read
           when 'words_reviewed' then d.words_reviewed end), 0)
  from public.shared_goals g
  join public.friendships f on f.id = g.friendship_id
  left join public.daily_progress d
    on d.user_id in (f.user_a, f.user_b) and d.day between g.start_day and g.end_day
  where g.id = p_goal and auth.uid() in (f.user_a, f.user_b);
$$;

-- ───────── RLS ─────────
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.daily_progress enable row level security;
alter table public.cheers enable row level security;
alter table public.shared_goals enable row level security;

create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.are_friends(auth.uid(), id));
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy friendships_select on public.friendships for select
  using (auth.uid() in (user_a, user_b));
create policy friendships_delete on public.friendships for delete
  using (auth.uid() in (user_a, user_b));

create policy progress_select on public.daily_progress for select
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
create policy progress_insert on public.daily_progress for insert
  with check (user_id = auth.uid());
create policy progress_update on public.daily_progress for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy cheers_select on public.cheers for select
  using (auth.uid() in (from_user, to_user));
create policy cheers_insert on public.cheers for insert
  with check (from_user = auth.uid() and public.are_friends(from_user, to_user));
-- 받은 사람만 읽음 처리 (read_at 외 컬럼은 아래 grant로 막는다)
create policy cheers_update on public.cheers for update
  using (to_user = auth.uid()) with check (to_user = auth.uid());

create policy goals_select on public.shared_goals for select
  using (exists (select 1 from public.friendships f
                 where f.id = friendship_id and auth.uid() in (f.user_a, f.user_b)));
create policy goals_insert on public.shared_goals for insert
  with check (created_by = auth.uid() and exists (
    select 1 from public.friendships f
    where f.id = friendship_id and auth.uid() in (f.user_a, f.user_b)));
create policy goals_delete on public.shared_goals for delete
  using (exists (select 1 from public.friendships f
                 where f.id = friendship_id and auth.uid() in (f.user_a, f.user_b)));

-- ───────── 권한 ─────────
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.friendships, public.daily_progress,
  public.cheers, public.shared_goals to authenticated;
grant update (display_name, learning_language) on public.profiles to authenticated;
grant insert, update (study_seconds, articles_read, words_reviewed, quiz_correct, quiz_total)
  on public.daily_progress to authenticated;
grant insert (from_user, to_user, kind) on public.cheers to authenticated;
grant update (read_at) on public.cheers to authenticated;
grant insert (friendship_id, metric, target, start_day, end_day, created_by),
  delete on public.shared_goals to authenticated;
grant delete on public.friendships to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.are_friends(uuid, uuid), public.connect_with_code(text), public.stats_for(uuid, date, date),
  public.goal_progress(uuid) to authenticated;
