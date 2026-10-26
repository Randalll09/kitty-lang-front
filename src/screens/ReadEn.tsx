import { Fragment, useEffect, useRef, useState } from 'react'
import { Cat } from '../components/Cat'
import { Icon } from '../components/Icon'
import { ARTICLES_EN } from '../data/articles.en'
import { FONT_SIZES, finishArticle, removeWord, saveWord, setLastArticle, update } from '../lib/store'
import { useUnderline } from '../lib/underline'
import type { Screen } from '../App'
import type { AppState } from '../types'

/** 영어 단어 하나. 따옴표가 낀 말(it's)과 하이픈 말(side-scrolling)은 한 단어로 본다. */
const WORD = /(\p{L}[\p{L}\p{N}'’]*(?:-[\p{L}\p{N}]+)*)/u

type Piece = { text: string } | { word: string; start: number }

function split(text: string): Piece[] {
  const out: Piece[] = []
  let at = 0
  // 캡처 그룹이 있는 split은 홀수 번째 조각이 단어다.
  text.split(WORD).forEach((part, i) => {
    if (part) out.push(i % 2 ? { word: part, start: at } : { text: part })
    at += part.length
  })
  return out
}

/** 단어장의 키: 소문자로 맞추고 's는 뗀다. */
const keyOf = (w: string) => w.toLowerCase().replace(/['’]s$/, '').replace(/['’]$/, '')

/** text[at]이 들어 있는 한 문장(. ! ? 기준) */
function sentenceAt(text: string, at: number) {
  const end = /[.!?]+["')\]]*(?=\s|$)/g
  let start = 0
  for (let m = end.exec(text); m; m = end.exec(text)) {
    const stop = m.index + m[0].length
    if (stop > at) return text.slice(start, stop).trim()
    start = stop
  }
  return text.slice(start).trim()
}

export function ReadEn({ state, id, back, go }: { state: AppState; id: string; back: () => void; go: (s: Screen) => void }) {
  const article = ARTICLES_EN.find((a) => a.id === id) ?? ARTICLES_EN[0]
  const { settings } = state
  const scroller = useRef<HTMLDivElement>(null)
  const maxPct = useRef(state.progress[article.id] ?? 0)
  const [pct, setPct] = useState(0)
  const [para, setPara] = useState(1)
  const [active, setActive] = useState<{ key: string; word: string; sentence: string; para: number; s: number; e: number } | null>(null)
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

  const ul = useUnderline({ articleId: article.id, title: article.title, lang: 'en', texts: article.paragraphs, scroller, state, flash })
  const activeMark = active ? ul.markFor(active.para, active.s, active.e) : undefined

  const toggleBookmark = () => {
    update((s) => ({ ...s, bookmarks: bookmarked ? s.bookmarks.filter((b) => b !== article.id) : [...s.bookmarks, article.id] }))
    flash(bookmarked ? '저장을 취소했어요' : '글을 저장했어요')
  }

  // 단어와 그 단어가 나온 문장을 저장한다. 뜻은 단어장에서 직접 적는다.
  const save = (key: string, sentence: string) =>
    update((s) => saveWord(s, { key, reading: '', meaning: '', source: article.kr, context: sentence }))

  const quickSave = (key: string, sentence: string) => {
    navigator.vibrate?.(30)
    if (state.words[key]) return flash(`${key}는 이미 저장했어요`)
    save(key, sentence)
    flash(`${key} 저장했어요`)
  }
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  const startPress = (e: React.PointerEvent, key: string, sentence: string) => {
    longPressed.current = false
    press.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        longPressed.current = true
        press.current = null
        quickSave(key, sentence)
      }, 500),
    }
  }
  const movePress = (e: React.PointerEvent) => {
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) cancelPress()
  }
  useEffect(() => cancelPress, [])

  const sessionWords = Object.values(state.words).filter((w) => w.lang === 'en' && w.source === article.kr).length
  const minutesLeft = Math.max(1, Math.ceil(article.minutes * (1 - pct)))
  const activeSaved = active ? !!state.words[active.key] : false

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

      <div ref={scroller} className={`body rscroll ${active && !ul.pen ? 'hasPop' : ''}`} onScroll={measure}>
        <div className="ahead">
          <div className="meta"><span className="tag">{article.topic}</span><span className="tag">{article.level}</span></div>
          <h1 className="en" lang="en">{article.title}</h1>
          <div className="meta">
            <span>{article.words}단어</span>
            <span>{pct > 0.97 ? '끝까지 읽었어요' : `약 ${minutesLeft}분 남음`}</span>
          </div>
        </div>
        <p className="hint">모르는 단어를 꾹 누르면 그 단어와 문장이 단어장에 저장돼요. 뜻은 단어장에서 적어요. 밑줄 펜을 켜면 글을 끌어서 밑줄을 그을 수 있어요.</p>
        <div className={`rpages en ${ul.pen ? 'pen' : ''}`} lang="en" style={{ fontSize: fs }} {...ul.bind}>
          {article.paragraphs.map((text, i) => (
            <p key={i} className="rp">
              {split(text).map((p, j, all) => {
                // 이 조각의 글자 위치: 앞 조각들의 길이 합
                const start = 'word' in p ? p.start : all.slice(0, j).reduce((n, q) => n + ('word' in q ? q.word.length : q.text.length), 0)
                if ('text' in p) return <Fragment key={j}>{ul.chars(p.text, start, i)}</Fragment>
                const key = keyOf(p.word)
                const sentence = sentenceAt(text, p.start)
                const e = p.start + p.word.length
                return (
                  <button
                    key={j}
                    type="button"
                    className={`w ${active?.key === key ? 'on' : ''} ${state.words[key] ? 'saved' : ''} ${ul.cls(i, p.start, e)}`}
                    {...ul.attrs(i, p.start, e)}
                    onPointerDown={ul.pen ? undefined : (ev) => startPress(ev, key, sentence)}
                    onPointerMove={ul.pen ? undefined : movePress}
                    onPointerUp={ul.pen ? undefined : cancelPress}
                    onPointerCancel={ul.pen ? undefined : cancelPress}
                    onPointerLeave={ul.pen ? undefined : cancelPress}
                    onContextMenu={(ev) => ev.preventDefault()}
                    onClick={() => {
                      if (ul.pen) return
                      if (longPressed.current) return void (longPressed.current = false)
                      setActive(active?.key === key ? null : { key, word: p.word, sentence, para: i, s: p.start, e })
                    }}
                  >
                    {p.word}{ul.badge(i, e)}
                  </button>
                )
              })}
            </p>
          ))}
        </div>

        <p className="src">
          출처: <a href={article.source.url} target="_blank" rel="noopener noreferrer">Simple English Wikipedia – {article.source.title}</a> ·{' '}
          <a href={article.source.licenseUrl} target="_blank" rel="noopener noreferrer">{article.source.license}</a>
        </p>

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
        {ul.penButton}
        <div className="sz">
          <span>글씨</span>
          <button type="button" aria-label="글씨 작게" disabled={settings.fontIndex === 0} onClick={() => setFont(-1)}>가</button>
          <button type="button" aria-label="글씨 크게" disabled={settings.fontIndex === FONT_SIZES.length - 1} onClick={() => setFont(1)} style={{ fontSize: 17 }}>가</button>
        </div>
      </div>

      {active && !ul.pen && (
        <div className="pop">
          <div className="hd">
            <span className="jp en" lang="en">{active.word}</span>
          </div>
          <div className="mean sent" lang="en">{active.sentence}</div>
          <div className="acts">
            <button
              className={`btn ${activeSaved ? 'peach' : 'mint'}`}
              type="button"
              onClick={() => (activeSaved ? update((s) => removeWord(s, active.key)) : save(active.key, active.sentence))}
            >
              {activeSaved ? '저장됨' : '단어 저장'}
            </button>
            {activeMark && (
              <button className="btn ask" type="button" onClick={() => { setActive(null); ul.open(activeMark.id) }}>밑줄 질문</button>
            )}
            <button className="btn ghost sq" type="button" onClick={() => setActive(null)}>닫기</button>
          </div>
        </div>
      )}
      {ul.sheet}
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </>
  )
}
