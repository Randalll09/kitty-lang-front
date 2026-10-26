import { useEffect, useState } from 'react'
import { configured } from '../lib/supabase'
import { addDays, today } from '../lib/dates'
import {
  type CheerKind, type GoalMetric, connectWithCode, connected, createGoal, deleteGoal, markCheersRead, partnerRead, partnerStreak,
  sendCheer, signIn, signOut, signUp, signedIn, sync, unreadCheers, updateName, useSocial,
} from '../lib/social'
import { dayTotals } from '../lib/store'
import type { AppState } from '../types'

const CHEERS: [CheerKind, string][] = [['cheer', '응원해요 📣'], ['nudge', '콕 찔러요 👉'], ['congrats', '축하해요 🎉']]
const CHEER_TEXT: Record<CheerKind, string> = { cheer: '응원을 보냈어요 📣', nudge: '콕 찔렀어요 👉', congrats: '축하해요 🎉' }
const METRICS: [GoalMetric, string, string][] = [['articles_read', '읽은 글', '편'], ['words_reviewed', '복습 단어', '개'], ['study_seconds', '학습 시간', '분']]
const PERIODS = [7, 14, 30]

const when = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function Together({ state }: { state: AppState }) {
  const social = useSocial()
  const [mode, setMode] = useState<'in' | 'up'>('up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editName, setEditName] = useState<string | null>(null)
  const [sent, setSent] = useState('')
  const [metric, setMetric] = useState<GoalMetric>('articles_read')
  const [target, setTarget] = useState('10')
  const [days, setDays] = useState(7)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)

  const hasPartner = connected(social)
  const unread = unreadCheers(social)

  // 화면을 열면 받은 응원을 읽은 것으로 표시한다. 방금 온 것은 이번 화면에서 굵게 보이도록 잠시 둔다.
  const [fresh] = useState(() => new Set(social.cheers.filter((c) => !c.read_at).map((c) => c.id)))
  useEffect(() => {
    if (!unread) return
    const t = setTimeout(() => void markCheersRead(), 1500)
    return () => clearTimeout(t)
  }, [unread])
  useEffect(() => {
    if (signedIn(social)) void sync(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const guard = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!configured) {
    return (
      <div className="body">
        <div className="top"><h2 style={{ fontSize: 22 }}>같이</h2></div>
        <div className="card tg">
          <h2>서버가 아직 연결되지 않았어요</h2>
          <p className="soft small" style={{ margin: 0 }}>
            프로젝트 폴더의 <code>.env</code> 에 Supabase 주소(<code>VITE_SUPABASE_URL</code>)와 anon key(<code>VITE_SUPABASE_ANON_KEY</code>)를 넣고 앱을 다시 빌드하면 친구와 같이 쓸 수 있어요. 그 전에도 기록은 이 폰에 저장돼요.
          </p>
        </div>
      </div>
    )
  }

  if (!signedIn(social)) {
    const up = mode === 'up'
    return (
      <div className="body">
        <div className="top"><h2 style={{ fontSize: 22 }}>같이</h2></div>
        <form
          className="card tg"
          onSubmit={(e) => {
            e.preventDefault()
            void guard(async () => {
              if (up) await signUp(email.trim(), password, name)
              else await signIn(email.trim(), password)
              await sync(state)
            })
          }}
        >
          <div className="seg" role="group" aria-label="로그인 방식">
            <button type="button" aria-pressed={up} onClick={() => setMode('up')}>처음이에요</button>
            <button type="button" aria-pressed={!up} onClick={() => setMode('in')}>로그인</button>
          </div>
          {up && (
            <label className="field">이름 (친구에게 보여요)
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
            </label>
          )}
          <label className="field">이메일
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="field">비밀번호 (6자 이상)
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={up ? 'new-password' : 'current-password'} />
          </label>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn peach block" type="submit" disabled={busy}>{busy ? '잠깐만요…' : up ? '가입하고 시작' : '로그인'}</button>
          <p className="soft small" style={{ margin: 0 }}>
            친구도 같은 방법으로 가입한 뒤 초대 코드로 이어져요. 서버에는 학습 시간, 읽은 글 수 같은 숫자만 올라가고 글이나 단어 내용은 올라가지 않아요.
          </p>
        </form>
      </div>
    )
  }

  const t = today()
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, -i))
  const partnerWeek = week.filter((d) => partnerRead(social, d)).length
  const pToday = social.partnerDays[t]
  const pName = social.partnerName || '친구'

  const status =
    social.status === 'syncing' ? '맞추는 중…' : social.status === 'offline' ? '오프라인 · 연결되면 맞춰요' : social.status === 'error' ? `맞추지 못했어요: ${social.error}` : social.lastSync ? '맞췄어요' : ''

  return (
    <div className="body">
      <div className="top">
        <h2 style={{ fontSize: 22 }}>같이</h2>
        <span className="soft small">{status}</span>
      </div>

      {!hasPartner ? (
        <div className="card tg">
          <h2>친구와 이어져요</h2>
          <p className="soft small" style={{ margin: 0 }}>내 코드를 친구에게 알려 주거나, 친구가 알려 준 코드를 넣어 주세요. 이어지면 여기에 친구의 오늘 기록이 나와요.</p>
          <div className="line">
            <span>내 코드 <b style={{ letterSpacing: 2 }}>{social.inviteCode || '…'}</b></span>
            <button
              className="btn ghost sm"
              type="button"
              disabled={!social.inviteCode}
              onClick={() => {
                void navigator.clipboard?.writeText(social.inviteCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }, () => {})
              }}
            >{copied ? '복사했어요' : '복사'}</button>
          </div>
          <form
            className="tg"
            onSubmit={(e) => {
              e.preventDefault()
              void guard(async () => { await connectWithCode(code, state); setCode('') })
            }}
          >
            <label className="field">친구의 코드
              <input value={code} maxLength={16} autoCapitalize="characters" autoComplete="off" onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </label>
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn peach block" type="submit" disabled={busy || !code.trim()}>{busy ? '잠깐만요…' : '이어지기'}</button>
          </form>
          <button className="btn ghost block" type="button" onClick={() => void sync(state)}>지금 확인</button>
        </div>
      ) : (
        <>
          <div className="card tg">
            <div className="line"><h2>{pName}</h2><span className="chip fire">연속 {partnerStreak(social)}일</span></div>
            <div className="mystats">
              <div><b>{partnerRead(social, t) ? '읽었어요' : '아직'}</b><span>오늘 독해</span></div>
              <div><b>{pToday ? Math.round(pToday.seconds / 60) : 0}분</b><span>오늘 학습</span></div>
              <div><b>{partnerWeek}/7일</b><span>이번 주 독해</span></div>
            </div>
            <div className="cheers">
              {CHEERS.map(([kind, label]) => (
                <button key={kind} className="btn mint" type="button" onClick={() => { sendCheer(kind, state); setSent(CHEER_TEXT[kind]); setTimeout(() => setSent(''), 2500) }}>{label}</button>
              ))}
            </div>
            <p className="soft small" style={{ margin: 0, minHeight: 18 }} aria-live="polite">
              {sent || (social.pending.length ? `보낼 응원 ${social.pending.length}개 · 연결되면 보내요` : '')}
            </p>
          </div>

          <div className="card tg">
            <h2>받은 응원</h2>
            {social.cheers.length ? (
              <div className="inbox">
                {social.cheers.slice(0, 5).map((c) => (
                  <div key={c.id} className={`line ${fresh.has(c.id) ? 'new' : ''}`}>
                    <span>{pName}: {c.kind === 'cheer' ? '힘내요! 📣' : c.kind === 'nudge' ? '오늘 같이 해요 👉' : '잘했어요 🎉'}</span>
                    <span className="soft small">{when(c.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="soft small" style={{ margin: 0 }}>아직 받은 응원이 없어요.</p>
            )}
          </div>

          <div className="card tg">
            <div className="line">
              <h2>같이 하는 목표</h2>
              <button className="btn ghost sm" type="button" onClick={() => setAdding(!adding)}>{adding ? '닫기' : '만들기'}</button>
            </div>
            {adding && (
              <form
                className="tg"
                onSubmit={(e) => {
                  e.preventDefault()
                  const n = Math.max(1, Math.floor(Number(target) || 0))
                  void guard(async () => {
                    await createGoal(metric, metric === 'study_seconds' ? n * 60 : n, days, state)
                    setAdding(false)
                  })
                }}
              >
                <div className="seg" role="group" aria-label="목표 종류">
                  {METRICS.map(([m, label]) => <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}>{label}</button>)}
                </div>
                <label className="field">둘이 합쳐서 ({METRICS.find((m) => m[0] === metric)![2]})
                  <input type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
                </label>
                <div className="seg" role="group" aria-label="기간">
                  {PERIODS.map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>{d}일</button>)}
                </div>
                <button className="btn peach block" type="submit" disabled={busy}>목표 만들기</button>
              </form>
            )}
            {social.goals.map((g) => {
              const [, label, unit] = METRICS.find((m) => m[0] === g.metric)!
              const div = g.metric === 'study_seconds' ? 60 : 1
              const now = Math.floor(g.progress / div)
              const goal = g.target / div
              const pct = Math.min(100, (now / goal) * 100)
              const left = Math.max(0, Math.round((new Date(g.end_day).getTime() - new Date(t).getTime()) / 86400000))
              return (
                <div key={g.id} className="goal">
                  <div className="line">
                    <span>{label} {goal}{unit}{now >= goal ? ' · 달성! 🎉' : ''}</span>
                    <button className="btn ghost sm" type="button" aria-label="목표 지우기" onClick={() => { if (confirm('이 목표를 지울까요?')) void guard(() => deleteGoal(g.id)) }}>지우기</button>
                  </div>
                  <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={now}>
                    <b style={{ width: `${pct}%` }} data-zero={now === 0 || undefined} />
                  </div>
                  <span className="soft small">{now} / {goal}{unit} · {g.end_day < t ? '끝났어요' : left === 0 ? '오늘까지' : `${left}일 남음`}</span>
                </div>
              )
            })}
            {!social.goals.length && !adding && <p className="soft small" style={{ margin: 0 }}>둘이 합쳐서 채우는 목표를 만들어 보세요.</p>}
            {error && <p className="err" role="alert">{error}</p>}
          </div>
        </>
      )}

      <div className="card tg">
        <h2>내 계정</h2>
        <div className="line">
          {editName === null ? (
            <>
              <span>{social.name || '이름 없음'}</span>
              <button className="btn ghost sm" type="button" onClick={() => setEditName(social.name)}>이름 바꾸기</button>
            </>
          ) : (
            <>
              <input value={editName} maxLength={20} onChange={(e) => setEditName(e.target.value)} aria-label="이름" />
              <button className="btn mint sm" type="button" onClick={() => void guard(async () => { await updateName(editName); setEditName(null) })}>저장</button>
            </>
          )}
        </div>
        <span className="soft small">{social.email} · 오늘 {dayTotals(state, today()).minutes}분 기록 중</span>
        <button className="btn ghost block" type="button" onClick={() => { if (confirm('로그아웃할까요? 이 폰의 학습 기록은 그대로 남아요.')) void signOut() }}>로그아웃</button>
      </div>
    </div>
  )
}
