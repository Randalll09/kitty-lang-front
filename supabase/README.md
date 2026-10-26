# supabase

언어 앱의 백엔드. 별도 서버 없이 **Supabase(Postgres + Auth + RLS)** 스키마와 정책만으로 구성해요.
(예전 `kitty-lang-back` 저장소의 내용을 이 저장소로 합쳤어요.)

## 왜 Supabase 스키마인가
- 사용자는 2명이라 직접 운영할 API 서버가 필요 없고, 무료 플랜으로 충분해요.
- 접근 규칙(본인 기록 쓰기, 친구 기록 읽기)을 RLS로 DB에 두면 앱이 우회할 수 없어요.
- 프론트(Capacitor)는 `@supabase/supabase-js`로 바로 호출해요.

## 저장하는 것 (숫자만)
| 테이블 | 내용 |
|---|---|
| `profiles` | 표시 이름, 학습 언어(ja/en), 친구 초대 코드 |
| `friendships` | 연결된 두 사람 |
| `daily_progress` | 하루·언어별 학습 시간(초), 읽은 글 수, 복습 단어 수, 정답 수/문제 수 |
| `cheers` | 응원 알림(종류 `cheer`/`nudge`/`congrats`만, 자유 텍스트 없음), 읽음 시각 |
| `shared_goals` | 두 사람 합산 공동 목표(지표, 목표값, 기간) |
| `saved_words` | 개인 단어장(단어, 읽기, 뜻, 나온 문장, 복습 상태). **본인만** 읽고 쓰며 친구에게도 보이지 않아요 |

친구와 공유하는 기록은 숫자뿐이에요. 글 제목과 퀴즈 문항은 저장하지 않고, 단어는 본인 단어장(`saved_words`)에만 둬요.

## API (supabase-js)
- 기록 올리기: 키 열(user_id, day, language)은 수정 권한이 없어 `upsert`는 막혀요. `update(숫자들).eq(user_id, day, language)`를 먼저 하고 없으면 `insert`해요.
- 단어장: `from('saved_words').upsert({ user_id, language, word_key, reading, meaning, source, context, box, due }, { onConflict: 'user_id,language,word_key' })`. 뜻 수정은 `update({ meaning })`, 삭제는 `delete()`. 한 사람당 2000개까지예요.
- 친구 연결: 초대 코드만 쓴다. 자동 연결 `connect_partner`는 20261026040000 마이그레이션에서 실행 권한을 모두 회수했다.
- 친구 연결(코드): `rpc('connect_with_code', { p_code })` (내 코드는 `profiles.invite_code`)
- 지표 보기: `rpc('stats_for', { p_user, p_from, p_to })` → 합계, 정답률, 연속 일수. 본인과 친구만 조회돼요.
- 응원 보내기: `from('cheers').insert({ from_user, to_user, kind })` (같은 상대에게 하루 20번까지)
- 받은 응원: `from('cheers').select().eq('to_user', me)`, 읽음 처리는 `update({ read_at })`
- 공동 목표: `from('shared_goals').insert(...)`, 진행도는 `rpc('goal_progress', { p_goal })`

## 적용
Supabase 프로젝트의 SQL Editor에 `migrations/*.sql`을 **파일 이름 순서대로** 붙여 넣어 실행해요. 또는 Supabase CLI의 `supabase db push`를 써요. 새 마이그레이션은 기존 파일을 고치지 말고 새 파일로 추가해요.

비밀번호와 service_role key는 저장소에 넣지 않아요. 앱에는 Project URL 과 anon key 만 써요.

## 밑줄 질문 (Edge Function `ask`)
읽기 화면에서 밑줄 친 부분을 Claude에게 물어보는 기능이에요. 앱이 Anthropic 에 직접 가지 않고, `functions/ask` 가 서버에서 키를 가지고 대신 호출해요.

- 키(`ANTHROPIC_API_KEY`)는 **Supabase secrets 에만** 둬요. 앱, 저장소, `.env` 에는 넣지 않아요.
- 로그인한 사용자만 쓸 수 있어요. 로그인 토큰을 확인하고, anon key 만으로는 거절해요.
- 남용 방지: 하루 40번(`ASK_DAILY_LIMIT`)과 2초 간격을 `take_ask_quota` 가 세요. 질문 내용은 저장하지 않고 횟수만 저장해요.
- 모델은 `claude-haiku-5-5` (가장 빠르고 싼 최신 모델, 입력 $0.10 / 출력 $0.50 per 1M 토큰). `ASK_MODEL` 로 바꿀 수 있어요.
- 함수가 없거나 인터넷이 없어도 앱은 "지금은 물어볼 수 없어요"만 보여 줘요.

켜는 순서:
1. SQL Editor 에서 `migrations/20261026090000_ask_quota.sql` 을 실행해요.
2. Supabase 대시보드 → Edge Functions → Secrets 에 `ANTHROPIC_API_KEY` 를 추가해요. (CLI: `supabase secrets set ANTHROPIC_API_KEY=...`) 키는 Anthropic Console 에서 만들고, 대화창에는 붙여 넣지 않아요.
3. 함수를 배포해요. CLI: `supabase functions deploy ask --project-ref <프로젝트 ref>`. 대시보드: Edge Functions → Deploy a new function → 이름 `ask` → `functions/ask/index.ts` 내용을 붙여 넣어요.

`SUPABASE_URL` 과 `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase 가 함수에 자동으로 넣어 줘요.

## 테스트
저장소 루트에서 `bash supabase/tests/run.sh` (Postgres 16 필요). 임시 DB에 auth 스키마 스텁을 깔고 마이그레이션과 RLS를 검증해요.

## 아직 없는 것
- 푸시 알림 전송(응원은 저장만 하며 앱이 열릴 때 가져와요)
