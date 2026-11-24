import { useState } from 'react'
import { Cat, type Pose } from './Cat'
import { accuracy, myTotals, partnerTotals, type Period, type Scope, type Totals } from '../lib/records'
import type { SocialState } from '../lib/social'
import type { AppState } from '../types'

const PERIODS: [Period, string][] = [[1, '오늘'], [7, '7일'], [30, '30일']]
const SCOPES: [Scope, string][] = [['all', '전체'], ['ja', '일본어'], ['en', '영어']]

const minutes = (t: Totals) => Math.round(t.seconds / 60)

interface Row {
  key: string
  icon: string
  label: string
  unit: string
  me: number | null
  you: number | null
}

/** 두 사람의 숫자를 나란히 보여 주는 공유 기록. 숫자만 나오고 글이나 단어 내용은 나오지 않는다. */
export function SharedStats({ state, social, partnerName }: { state: AppState; social: SocialState; partnerName: string }) {
  const [period, setPeriod] = useState<Period>(7)
  const [scope, setScope] = useState<Scope>(state.lang)

  const me = myTotals(state, scope, period)
  const you = partnerTotals(social, scope, period)
  const rows: Row[] = [
    { key: 'time', icon: '⏰', label: '학습 시간', unit: '분', me: minutes(me), you: minutes(you) },
    { key: 'read', icon: '📖', label: '읽은 글', unit: '편', me: me.articles, you: you.articles },
    { key: 'words', icon: '🔤', label: '복습 단어', unit: '개', me: me.reviewed, you: you.reviewed },
    { key: 'streak', icon: '🔥', label: '연속 일수', unit: '일', me: me.streak, you: you.streak },
    { key: 'acc', icon: '🎯', label: '정답률', unit: '%', me: accuracy(me), you: accuracy(you) },
  ]

  // 고양이: 둘 다 오늘 읽었으면 기뻐하고, 아무도 안 읽었으면 졸고, 한쪽만 읽었으면 앉아서 기다린다.
  const mineToday = myTotals(state, scope, 1)
  const yourToday = partnerTotals(social, scope, 1)
  const pose: Pose = mineToday.articles && yourToday.articles ? 'happy' : !mineToday.articles && !yourToday.articles ? 'sleep' : 'sit'
  const catText = pose === 'happy' ? '둘 다 오늘 읽었어요! 🎉' : pose === 'sleep' ? '오늘은 둘 다 조용해요…' : mineToday.articles ? `${partnerName}를 기다려요` : '오늘 읽으러 가요!'

  return (
    <div className="card tg stats">
      <div className="line">
        <h2>우리 기록</h2>
        <span className="chip fire">같이 {Math.min(me.streak, you.streak)}일째</span>
      </div>
      <div className="seg" role="group" aria-label="기간">
        {PERIODS.map(([p, label]) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{label}</button>)}
      </div>
      <div className="seg" role="group" aria-label="학습 언어">
        {SCOPES.map(([s, label]) => <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}>{label}</button>)}
      </div>

      <div className="st-head" aria-hidden="true">
        <span />
        <b className="me">나</b>
        <b className="you">{partnerName}</b>
      </div>
      {rows.map((r) => {
        const max = Math.max(r.me ?? 0, r.you ?? 0, 1)
        const fmt = (n: number | null) => (n === null ? '–' : `${n}${r.unit}`)
        return (
          <div key={r.key} className="st-row" role="group" aria-label={`${r.label}: 나 ${fmt(r.me)}, ${partnerName} ${fmt(r.you)}`}>
            <span className="st-label">{r.icon} {r.label}</span>
            <div className="st-cell me">
              <div className="bar"><b style={{ width: `${((r.me ?? 0) / max) * 100}%` }} data-zero={!r.me || undefined} /></div>
              <em>{fmt(r.me)}</em>
            </div>
            <div className="st-cell you">
              <div className="bar"><b style={{ width: `${((r.you ?? 0) / max) * 100}%` }} data-zero={!r.you || undefined} /></div>
              <em>{fmt(r.you)}</em>
            </div>
          </div>
        )
      })}

      <div className="st-cat">
        <Cat pose={pose} scale={0.6} />
        <span className="soft small">{catText}</span>
      </div>
    </div>
  )
}
