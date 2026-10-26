import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Paw } from '../components/Paw'
import { dayString, today } from '../lib/dates'
import { partnerRead, useSocial, connected } from '../lib/social'
import { dayTotals } from '../lib/store'
import type { AppState } from '../types'

const WEEK = '일월화수목금토'.split('')
const pad = (n: number) => String(n).padStart(2, '0')
const MAX_BACK = 11

export function Calendar({ state }: { state: AppState }) {
  const social = useSocial()
  const now = new Date()
  const [offset, setOffset] = useState(0) // 0 이번 달, -1 지난 달…
  const [sel, setSel] = useState(today())

  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const y = first.getFullYear()
  const m = first.getMonth() + 1
  const dim = new Date(y, m, 0).getDate()
  const key = (d: number) => `${y}-${pad(m)}-${pad(d)}`
  const t = today()
  const hasFriend = connected(social)

  const me = (d: number) => dayTotals(state, key(d)).read
  const fr = (d: number) => hasFriend && partnerRead(social, key(d))

  let mine = 0
  let both = 0
  let best = 0
  let run = 0
  for (let d = 1; d <= dim; d++) {
    if (key(d) > t) break
    if (me(d)) {
      mine++
      run++
      best = Math.max(best, run)
      if (fr(d)) both++
    } else run = 0
  }

  const move = (n: number) => {
    const next = offset + n
    setOffset(next)
    const f = new Date(now.getFullYear(), now.getMonth() + next, 1)
    setSel(next === 0 ? t : dayString(new Date(f.getFullYear(), f.getMonth() + 1, 0)))
  }

  const sm = dayTotals(state, sel)
  const sp = social.partnerDays[sel]
  const selMine = sm.read
  const acc = (c: number, n: number) => (n ? `${Math.round((c / n) * 100)}%` : '-')

  return (
    <div className="body">
      <div className="top">
        <h2 style={{ fontSize: 22 }}>학습 기록</h2>
        <span className="chip lang">일본어·영어</span>
      </div>

      <div className="cmonth">
        <button className="iconbtn" type="button" aria-label="이전 달" disabled={offset <= -MAX_BACK} onClick={() => move(-1)}><Icon name="back" /></button>
        <h2>{y}년 {m}월</h2>
        <button className="iconbtn" type="button" aria-label="다음 달" disabled={offset >= 0} onClick={() => move(1)}>
          <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><Icon name="back" /></span>
        </button>
      </div>

      <div className="cgrid">
        {WEEK.map((w) => <span key={w} className="wd">{w}</span>)}
        {Array.from({ length: first.getDay() }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: dim }, (_, i) => {
          const d = i + 1
          const k = key(d)
          const future = k > t
          const a = !future && me(d)
          const b = !future && fr(d)
          const label = `${m}월 ${d}일${a && b ? ', 같이 했어요' : a ? ', 내가 했어요' : b ? ', 친구만 했어요' : ''}`
          return (
            <button key={d} type="button" className={`day ${k === t ? 'today' : ''}`} aria-pressed={sel === k} aria-label={label} disabled={future} onClick={() => setSel(k)}>
              <span className="n">{d}</span>
              {a && b ? <><Paw who="me" cls="a" /><Paw who="fr" cls="b" /></> : a ? <Paw who="me" cls="solo" /> : b ? <Paw who="fr" cls="mini" /> : null}
            </button>
          )
        })}
      </div>

      <div className="legend">
        <span><Paw who="me" />내가 한 날</span>
        <span><Paw who="me" /><Paw who="fr" cls="ov" />같이 한 날</span>
        <span><Paw who="fr" />친구만</span>
      </div>
      <p className="soft small" style={{ margin: 0 }}>그날 글 한 편을 다 읽으면 발바닥이 찍혀요.</p>

      <div className="cstats">
        <div><b>{mine}일</b><span>내 학습일</span></div>
        <div><b>{hasFriend ? `${both}일` : '-'}</b><span>같이 한 날</span></div>
        <div><b>{best}일</b><span>최장 연속</span></div>
      </div>

      <div className="card cdet">
        <h2>{Number(sel.slice(5, 7))}월 {Number(sel.slice(8))}일{sel === t ? ' (오늘)' : ''}</h2>
        {selMine || sm.minutes > 0 ? (
          <div className="row">
            <span className="av me">나</span>
            <span className="v">
              <span><b>{sm.minutes}</b>분</span>
              <span>글 <b>{sm.articles}</b>편</span>
              <span>복습 <b>{sm.reviewed}</b>개</span>
              <span>정답률 <b>{acc(sm.quizCorrect, sm.quizTotal)}</b></span>
            </span>
          </div>
        ) : (
          <div className="row"><span className="av me">나</span><span className="v soft">쉬었어요</span></div>
        )}
        {hasFriend ? (
          sp && (sp.seconds > 0 || sp.articles > 0) ? (
            <div className="row">
              <span className="av fr">친</span>
              <span className="v">
                <span><b>{Math.round(sp.seconds / 60)}</b>분</span>
                <span>글 <b>{sp.articles}</b>편</span>
                <span>복습 <b>{sp.reviewed}</b>개</span>
                <span>정답률 <b>{acc(sp.correct, sp.total)}</b></span>
              </span>
            </div>
          ) : (
            <div className="row"><span className="av fr">친</span><span className="v soft">쉬었어요</span></div>
          )
        ) : (
          <p className="soft small" style={{ margin: 0 }}>‘같이’ 탭에서 로그인하면 친구 기록도 여기에 나와요.</p>
        )}
      </div>
    </div>
  )
}
