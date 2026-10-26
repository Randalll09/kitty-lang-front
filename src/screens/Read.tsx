import { Fragment, useEffect, useRef, useState } from 'react'
import { Cat } from '../components/Cat'
import { Icon } from '../components/Icon'
import { ARTICLES } from '../data/articles'
import { charCount, parse, sentenceAt, tokenKey, tokenReading, type Piece, type Token } from '../lib/markup'
import { FONT_SIZES, finishArticle, saveWord, removeWord, setLastArticle, update } from '../lib/store'
import type { Screen } from '../App'
import type { AppState } from '../types'

function Ruby({ t }: { t: Token }) {
  return t.reading ? (
    <ruby>{t.surface}<rt>{t.reading}</rt></ruby>
  ) : (
    <>{t.surface}</>
  )
}

export function Read({ state, id, go, back }: { state: AppState; id: string; go: (s: Screen) => void; back: () => void }) {
  const article = ARTICLES.find((a) => a.id === id) ?? ARTICLES[0]
  const { settings } = state
  const scroller = useRef<HTMLDivElement>(null)
  const maxPct = useRef(state.progress[article.id] ?? 0)
  const [pct, setPct] = useState(0)
  const [para, setPara] = useState(1)
  const [active, setActive] = useState<Token | null>(null)
  const [toast, setToast] = useState('')
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const longPressed = useRef(false)
  const finished = (state.progress[article.id] ?? 0) >= 100
  const bookmarked = state.bookmarks.includes(article.id)

  useEffect(() => {
    update((s) => setLastArticle(s, article.id))
  }, [article.id])

  // 떠날 때 가장 멀리 읽은 위치를 저장한다. 다 읽었어요를 누르면 이미 100이다.
  useEffect(
    () => () => {
      const best = Math.round(maxPct.current)
      update((s) => ((s.progress[article.id] ?? 0) >= best ? s : { ...s, progress: { ...s.progress, [article.id]: best } }))
    },
    [article.id],
  )

  const measure = () => {
    const el = scroller.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const p = max > 0 ? Math.min(1, el.scrollTop / max) : 1
    setPct(p)
    maxPct.current = Math.max(maxPct.current, Math.min(95, p * 100))
    const line = el.scrollTop + el.clientHeight * 0.45
    let n = 1
    el.querySelectorAll<HTMLElement>('.rp').forEach((p, i) => {
      if (p.offsetTop <= line) n = i + 1
    })
    setPara(n)
  }
  useEffect(measure, [])

  const flash = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 1600)
  }

  const toggleBookmark = () => {
    update((s) => ({ ...s, bookmarks: bookmarked ? s.bookmarks.filter((b) => b !== article.id) : [...s.bookmarks, article.id] }))
    flash(bookmarked ? '저장을 취소했어요' : '글을 저장했어요')
  }

  const toggleWord = (t: Token) => {
    const key = tokenKey(t)
    update((s) => (s.words[key] ? removeWord(s, key) : saveWord(s, { key, reading: tokenReading(t), meaning: t.meaning, source: article.kr })))
  }

  // 꾹 누르면 뜻 말풍선 없이 바로 저장한다. 이미 저장한 단어는 그대로 둔다.
  const quickSave = (t: Token, pieces: Piece[], index: number) => {
    const key = tokenKey(t)
    navigator.vibrate?.(30)
    if (state.words[key]) return flash(`${key}는 이미 저장했어요`)
    update((s) => saveWord(s, { key, reading: tokenReading(t), meaning: t.meaning, source: article.kr, context: sentenceAt(pieces, index) }))
    flash(`${key} 저장했어요`)
  }
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  const startPress = (e: React.PointerEvent, t: Token, pieces: Piece[], index: number) => {
    longPressed.current = false
    press.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        longPressed.current = true
        press.current = null
        quickSave(t, pieces, index)
      }, 500),
    }
  }
  const movePress = (e: React.PointerEvent) => {
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) cancelPress()
  }
  useEffect(() => cancelPress, [])

  const savedKeys = state.words
  const activeSaved = active ? !!savedKeys[tokenKey(active)] : false
  const sessionWords = Object.values(savedKeys).filter((w) => w.source === article.kr).length
  const minutesLeft = Math.max(1, Math.ceil(article.minutes * (1 - pct)))

  const finish = () => {
    if (finished) return go({ name: 'quiz', id: article.id })
    maxPct.current = 100
    update((s) => finishArticle(s, article.id))
  }

  const fs = FONT_SIZES[settings.fontIndex]
  const setFont = (d: number) =>
    update((s) => ({ ...s, settings: { ...s.settings, fontIndex: Math.max(0, Math.min(FONT_SIZES.length - 1, s.settings.fontIndex + d)) } }))

  return (
    <>
      <div className="rtop">
        <button className="iconbtn" type="button" onClick={back} aria-label="글 고르기로 돌아가기"><Icon name="back" /></button>
        <div className="ttl">{article.kr}</div>
        <button className="iconbtn" type="button" aria-pressed={bookmarked} aria-label="글 저장" onClick={toggleBookmark}><Icon name="mark" /></button>
      </div>
      <div className="prog">
        <div className="pbar"><b style={{ width: `${pct * 100}%` }} /></div>
        <span>문단 {para}/{article.paragraphs.length}</span>
      </div>

      <div ref={scroller} className={`body rscroll ${settings.furigana ? '' : 'nofuri'} ${active ? 'hasPop' : ''}`} onScroll={measure}>
        <div className="ahead">
          <div className="meta"><span className="tag">{article.topic}</span><span className="tag">{article.level}</span></div>
          <h1>{parse(article.title).map((p, i) => ('text' in p ? <Fragment key={i}>{p.text}</Fragment> : <Fragment key={i}><Ruby t={p.token} />{p.token.tail}</Fragment>))}</h1>
          <div className="meta">
            <span>샘플 글</span>
            <span>약 {Math.round(charCount(article.paragraphs) / 10) * 10}자</span>
            <span>{pct > 0.97 ? '끝까지 읽었어요' : `약 ${minutesLeft}분 남음`}</span>
          </div>
        </div>
        <p className="hint">단어를 누르면 뜻이 나와요. 꾹 누르면 바로 단어장에 저장돼요.</p>
        <div className="rpages" style={{ fontSize: fs }}>
          {article.paragraphs.map((para, i) => (
            <p key={i} className="rp">
              {parse(para).map((p, j, pieces) =>
                'text' in p ? (
                  <Fragment key={j}>{p.text}</Fragment>
                ) : (
                  <button
                    key={j}
                    type="button"
                    className={`w ${active && tokenKey(active) === tokenKey(p.token) ? 'on' : ''} ${savedKeys[tokenKey(p.token)] ? 'saved' : ''}`}
                    onPointerDown={(e) => startPress(e, p.token, pieces, j)}
                    onPointerMove={movePress}
                    onPointerUp={cancelPress}
                    onPointerCancel={cancelPress}
                    onPointerLeave={cancelPress}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => {
                      if (longPressed.current) return void (longPressed.current = false)
                      setActive(active && tokenKey(active) === tokenKey(p.token) ? null : p.token)
                    }}
                  >
                    <Ruby t={p.token} />{p.token.tail}
                  </button>
                ),
              )}
            </p>
          ))}
        </div>

        <div className="end">
          <Cat pose="happy" scale={0.9} />
          <h2>여기까지 읽었어요</h2>
          <div className="nums">
            <div><b>{sessionWords}</b><span>저장한 단어</span></div>
            <div><b>{article.minutes}</b><span>읽는 시간(분)</span></div>
          </div>
          <button className={`btn block ${finished ? 'mint' : 'peach'}`} type="button" onClick={finish}>
            {finished ? '퀴즈 풀러 가기' : '다 읽었어요'}
          </button>
        </div>
      </div>

      <div className="tools">
        <button
          className="sw"
          type="button"
          aria-pressed={settings.furigana}
          onClick={() => update((s) => ({ ...s, settings: { ...s.settings, furigana: !s.settings.furigana } }))}
        >
          <span className="knob" />후리가나
        </button>
        <div className="sz">
          <span>글씨</span>
          <button type="button" aria-label="글씨 작게" disabled={settings.fontIndex === 0} onClick={() => setFont(-1)}>가</button>
          <button type="button" aria-label="글씨 크게" disabled={settings.fontIndex === FONT_SIZES.length - 1} onClick={() => setFont(1)} style={{ fontSize: 17 }}>가</button>
        </div>
      </div>

      {active && (
        <div className="pop">
          <div className="hd">
            <span className="jp">{tokenKey(active)}</span>
            <span className="rd">{tokenReading(active)}</span>
          </div>
          <div className="mean">{active.meaning || '(뜻 없음)'}</div>
          <div className="acts">
            <button className={`btn ${activeSaved ? 'peach' : 'mint'}`} type="button" onClick={() => toggleWord(active)}>
              {activeSaved ? '저장됨' : '단어 저장'}
            </button>
            <button className="btn ghost sq" type="button" onClick={() => setActive(null)}>닫기</button>
          </div>
        </div>
      )}
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </>
  )
}
