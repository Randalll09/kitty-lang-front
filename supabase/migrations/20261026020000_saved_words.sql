-- 단어장 동기화: 읽기 화면에서 꾹 눌러 저장한 단어를 서버에도 둔다.
-- 숫자만 저장한다는 원칙의 예외다. 친구와 공유하는 기록이 아니라 본인만 읽고 쓰는 개인 단어장이며,
-- RLS가 친구의 조회도 막는다. 친구에게 보이는 숫자(daily_progress)는 그대로다.
create table public.saved_words (
  user_id uuid not null references public.profiles (id) on delete cascade,
  language text not null check (language in ('ja', 'en')),
  -- 표기 + 뒤에 붙는 가나(프론트 VocabEntry.key)
  word_key text not null check (char_length(word_key) between 1 and 100),
  reading text not null default '' check (char_length(reading) <= 100),
  -- 뜻풀이가 없는 글에서 저장한 단어는 비어 있고, 나중에 사용자가 채운다.
  meaning text not null default '' check (char_length(meaning) <= 300),
  source text not null default '' check (char_length(source) <= 200),
  -- 단어가 나온 문장
  context text not null default '' check (char_length(context) <= 500),
  -- 0 새 단어, 1 익히는 중, 2 외웠어요
  box smallint not null default 0 check (box between 0 and 2),
  -- 다음 복습일
  due date not null default current_date,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, language, word_key)
);

create index saved_words_due on public.saved_words (user_id, language, due);

create trigger saved_words_touch
  before update on public.saved_words
  for each row execute function public.touch_updated_at();

-- 한 사람이 2000개까지만 저장할 수 있다.
create function public.limit_saved_words() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.saved_words where user_id = new.user_id) >= 2000 then
    raise exception 'too many saved words';
  end if;
  return new;
end $$;

create trigger saved_words_limit before insert on public.saved_words
  for each row execute function public.limit_saved_words();

alter table public.saved_words enable row level security;

create policy saved_words_select on public.saved_words for select using (user_id = auth.uid());
create policy saved_words_insert on public.saved_words for insert with check (user_id = auth.uid());
create policy saved_words_update on public.saved_words for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_words_delete on public.saved_words for delete using (user_id = auth.uid());

-- 키 열은 고칠 수 없고(고치려면 지우고 다시 저장), 본인 행이라 upsert는 가능하다.
grant select, delete on public.saved_words to authenticated;
grant insert (user_id, language, word_key, reading, meaning, source, context, box, due, added_at)
  on public.saved_words to authenticated;
grant update (reading, meaning, source, context, box, due) on public.saved_words to authenticated;
