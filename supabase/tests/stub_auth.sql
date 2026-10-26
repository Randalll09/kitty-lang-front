-- Supabase 밖(일반 Postgres)에서 테스트할 때만 쓰는 auth 스텁
create schema if not exists auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  create role anon nologin; create role authenticated nologin;
exception when duplicate_object then null; end $$;
grant usage on schema public, auth to anon, authenticated;
