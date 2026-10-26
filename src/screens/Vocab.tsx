import { useEffect, useRef, useState } from 'react'
import { Cat } from '../components/Cat'
import { completeTask, dueWords, gradeWord, removeWord, update } from '../lib/store'
import type { AppState } from '../types'

const ST = ['새 단어', '익히는 중', '외웠어요']
const FILTERS = ['전체', ...ST]

export function Vocab({ state, initialTab }: { state: AppState; initialTab?: 'list' | 'review' }) {
  const [tab, setTab] = useState<'list' | 'review'>(initialTab ?? 'review')
  const count = Object.keys(state.words).length

  useEffect(() => {
    if (tab === 'list') update((s) => completeTask(s, 'words'))
  }, [tab])

  return (
    <div className="body">
      <div className="top">
        <h2 style={{ fontSize: 22 }}>단어장</h2>
        <span className="chip coin">{count}개</span>
      </div>
      <div className="seg" role="group" aria-label="보기">
        <button type="button" aria-pressed={tab === 'list'} onClick={() => setTab('list')}>내 단어</button>
        <button type="button" aria-pressed={tab === 'review'} onClick={() => setTab('review')}>복습</button>
      </div>
      {tab === 'list' ? <List state={state} /> : <Review state={state} />}
    </div>
  )
}

function List({ state }: { state: AppState }) {
  const [filter, setFilter] = useState('전체')
  const rows = Object.values(state.words)
    .sort((a, b) => b.addedAt - a.addedAt)
    .filter((w) => filter === '전체' || ST[w.box] === filter)
  return (
    <>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="wl">
        {rows.length === 0 && (
          <p className="soft center" style={{ margin: '24px 0' }}>
            {Object.keys(state.words).length ? '해당하는 단어가 없어요' : '글을 읽다가 모르는 단어를 눌러 저장해 보세요'}
          </p>
        )}
        {rows.map((w) => (
          <div key={w.key} className="wrow">
            <div className="a">
              <div className="jp">{w.key}{w.reading && <small>{w.reading}</small>}</div>
              <div className="kr">{w.meaning} · {w.source}</div>
            </div>
            <span className={`st st${w.box}`}>{ST[w.box]}</span>
            <button className="del" type="button" aria-label={`${w.key} 삭제`} onClick={() => update((s) => removeWord(s, w.key))}>×</button>
          </div>
        ))}
      </div>
    </>
  )
}

function Review({ state }: { state: AppState }) {
  // 시작할 때의 복습 목록을 고정해 두고, 모르는 단어는 한 번 뒤로 보낸다.
  const [queue, setQueue] = useState<string[]>(() => dueWords(state).slice(0, 10).map((w) => w.key))
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [eating, setEating] = useState(false)
  const [knew, setKnew] = useState(0)
  const retried = useRef(new Set<string>())
  const [total, setTotal] = useState(queue.length)

  const finished = pos >= queue.length
  useEffect(() => {
    if (finished && total > 0) update((s) => completeTask(s, 'review'))
  }, [finished, total])

  const restart = () => {
    const next = dueWords(state).slice(0, 10).map((w) => w.key)
    setTotal(next.length)
        retried.current = new Set()
    setQueue(next)
    setPos(0)
    setKnew(0)
    setFlipped(false)
  }

  if (finished) {
    const mastered = Object.values(state.words).filter((w) => w.box === 2).length
    return (
      <>
        <div className="card rdone">
          <Cat pose="sleep" scale={1.2} />
          <h2>{total ? '오늘 복습 끝!' : '복습할 단어가 없어요'}</h2>
          <span className="soft small">{total ? '고양이가 배불러서 낮잠을 자요' : '글을 읽고 단어를 저장해 보세요'}</span>
          {total > 0 && (
            <div className="nums">
              <div><b>{total}</b><span>복습한 단어</span></div>
              <div><b>{knew}</b><span>알고 있던 단어</span></div>
              <div><b>{mastered}</b><span>외운 단어</span></div>
            </div>
          )}
        </div>
        {dueWords(state).length > 0 && (
          <button className="btn ghost block" type="button" onClick={restart}>한 번 더 복습</button>
        )}
      </>
    )
  }

  const w = state.words[queue[pos]]
  if (!w) {
    // 복습 도중 다른 곳에서 지워진 단어는 건너뛴다.
    setTimeout(() => setPos((p) => p + 1))
    return null
  }

  const grade = (yes: boolean) => {
    update((s) => gradeWord(s, w.key, yes))
    const advance = () => {
      if (!yes && !retried.current.has(w.key)) {
        retried.current.add(w.key)
        setQueue((q) => [...q, w.key])
      }
      setPos((p) => p + 1)
      setFlipped(false)
      setEating(false)
    }
    if (yes) {
      setKnew((n) => n + 1)
      setEating(true)
      setTimeout(advance, matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 1400)
    } else advance()
  }

  return (
    <>
      <div className="top">
        <span className="soft small">오늘 복습</span>
        <b style={{ fontFamily: 'var(--f-display)', fontWeight: 400 }}>{pos + 1} / {queue.length}</b>
      </div>
      <button className="flip" type="button" aria-label="카드 뒤집기" onClick={() => setFlipped((f) => !f)}>
        <span className="jp">{w.key}</span>
        {flipped ? (
          <>
            {w.reading && <span className="rd">{w.reading}</span>}
            <span className="mean">{w.meaning}</span>
          </>
        ) : (
          <span className="tapnote">눌러서 뜻 보기</span>
        )}
      </button>
      <div className="rbtns">
        <button className="btn ghost" type="button" disabled={eating} onClick={() => grade(false)}>다시 볼래요</button>
        <button className="btn mint" type="button" disabled={eating} onClick={() => grade(true)}>알아요</button>
      </div>
      <div className="feed">
        <Cat pose={eating ? 'eat' : 'loaf'} scale={0.95} />
        <span className="say">{eating ? '냠냠! 간식 +1' : '알면 간식을 줄 수 있어요'}</span>
      </div>
    </>
  )
}
