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

-- 초대 코드 없이 자동 연결: 기존 사용자를 지우고 D, E로 확인한다.
reset role;
delete from public.shared_goals;
delete from auth.users where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.connect_partner() is null as waits_alone;
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select public.connect_partner() is not null as e_pairs_with_d;
select public.connect_partner() = (select id from public.friendships) as idempotent;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.connect_partner() = (select id from public.friendships) and count(*) = 1 as d_sees_same_pair from public.friendships;
-- 단어장: 본인만 읽고 쓴다. 친구(D, E)도 서로의 단어장은 못 본다.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.saved_words (user_id, language, word_key, reading, meaning, context)
  values (auth.uid(), 'ja', '紅葉', 'こうよう', '단풍', '紅葉が見ごろです。');
insert into public.saved_words (user_id, language, word_key, context)
  values (auth.uid(), 'en', 'cat', 'The cat sat.');  -- 뜻 없이 저장
update public.saved_words set meaning = '고양이', box = 1 where word_key = 'cat';
select meaning = '고양이' and box = 1 as d_fills_meaning from public.saved_words where word_key = 'cat';
insert into public.saved_words (user_id, language, word_key, meaning)
  values (auth.uid(), 'ja', '紅葉', '단풍잎')
  on conflict (user_id, language, word_key) do update set meaning = excluded.meaning;
select meaning = '단풍잎' as d_upsert_ok from public.saved_words where word_key = '紅葉';
select count(*) = 2 as d_two_words from public.saved_words;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select count(*) = 0 as e_cannot_see_friend_words from public.saved_words;
update public.saved_words set meaning = 'x';  -- 남의 행이라 0행
do $$ begin
  begin
    insert into public.saved_words (user_id, language, word_key)
      values ('00000000-0000-0000-0000-00000000000d', 'ja', 'x');
    raise exception 'E should not write D words';
  exception when others then
    if sqlerrm = 'E should not write D words' then raise; end if;
  end;
  begin
    insert into public.saved_words (user_id, language, word_key, box)
      values (auth.uid(), 'ja', 'x', 3);
    raise exception 'box 3 should be rejected';
  exception when others then
    if sqlerrm = 'box 3 should be rejected' then raise; end if;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select count(*) = 2 and bool_and(meaning <> 'x') as d_words_untouched from public.saved_words;

select 'ALL OK' as result;
-- 위 select 결과 중 f(false)가 하나라도 있으면 실패다. tests/run.sh가 이를 검사한다.
