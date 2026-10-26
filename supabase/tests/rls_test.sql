-- 로컬 Postgres에서 실행: psql -v ON_ERROR_STOP=1 -f supabase/tests/stub_auth.sql -f supabase/migrations/*.sql(여러 개면 각각 -f) -f supabase/tests/rls_test.sql
\set ON_ERROR_STOP on
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');

create function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claim.sub', u, false) $$;

set role authenticated;

-- A가 B의 코드로 연결
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select invite_code as b_code from public.profiles where id = auth.uid() \gset
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.connect_with_code(:'b_code') is not null as connected;

-- A 기록 (3일 연속: 오늘, 어제, 그저께)
insert into public.daily_progress (user_id, day, language, study_seconds, articles_read, quiz_correct, quiz_total)
select auth.uid(), current_date - n, 'ja', 600, 1, 3, 4 from generate_series(0, 2) n;

-- B는 A 기록을 보고, C는 못 본다
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select count(*) = 3 as b_sees_a from public.daily_progress;
select streak = 3 and accuracy = 0.75 and study_seconds = 1800 as stats_ok
  from public.stats_for('00000000-0000-0000-0000-00000000000a', current_date - 6, current_date);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select count(*) = 0 as c_sees_nothing from public.daily_progress;
select count(*) = 0 as c_stats_empty
  from public.stats_for('00000000-0000-0000-0000-00000000000a', current_date - 6, current_date);

-- B가 A에게 응원, C는 못 보냄
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.cheers (from_user, to_user) values (auth.uid(), '00000000-0000-0000-0000-00000000000a');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin
    insert into public.cheers (from_user, to_user) values (auth.uid(), '00000000-0000-0000-0000-00000000000a');
    raise exception 'C should not be able to cheer';
  exception when insufficient_privilege or others then
    if sqlerrm = 'C should not be able to cheer' then raise; end if;
  end;
end $$;

-- A는 응원을 받아 읽음 처리, 남의 기록은 못 고침
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select count(*) = 1 as a_got_cheer from public.cheers where to_user = auth.uid();
update public.cheers set read_at = now() where to_user = auth.uid();
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.daily_progress set study_seconds = 0;  -- B 소유 행이 없어 0행
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select count(*) = 3 and sum(study_seconds) = 1800 as a_rows_untouched from public.daily_progress;

-- 공동 목표
insert into public.shared_goals (friendship_id, metric, target, start_day, end_day, created_by)
select id, 'articles_read', 10, current_date - 6, current_date, auth.uid() from public.friendships;
select public.goal_progress(id) = 3 as goal_ok from public.shared_goals;

-- 자동 연결은 꺼져 있고, 초대 코드 연결은 한 사람당 한 쌍만 허용한다. D, E, F로 확인한다.
reset role;
delete from public.shared_goals;
delete from auth.users where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-00000000000f');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select exists (select 1 from pg_proc where proname = 'connect_partner') and not has_function_privilege('authenticated', 'public.connect_partner()', 'execute') as auto_pair_disabled;
select invite_code as d_code from public.profiles where id = auth.uid() \gset
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select public.connect_with_code(:'d_code') is not null as e_pairs_with_d;
select public.connect_with_code(:'d_code') = (select id from public.friendships) as idempotent;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select 'do $x$ begin perform public.connect_with_code(' || quote_literal(:'d_code') || '); raise exception ''third connect allowed''; exception when others then if sqlerrm <> ''already paired'' then raise; end if; end $x$' \gexec
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select count(*) = 1 as d_sees_one_pair from public.friendships;
select 'ALL OK' as result;
-- 위 select 결과 중 f(false)가 하나라도 있으면 실패다. tests/run.sh가 이를 검사한다.
