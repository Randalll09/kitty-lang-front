import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AskSheet } from '../components/AskSheet'
import { Icon } from '../components/Icon'
import { addMark, update } from './store'
import type { AppState, Mark } from '../types'

interface Range {
  para: number
  s: number
  e: number
}

interface Options {
  articleId: string
  title: string
  lang: 'ja' | 'en'
  /** 문단마다 화면에 보이는 글(plain). 밑줄 위치는 이 글의 글자 번호다. */
  texts: string[]
  /** 일본어: 문단 [s, e) 구간을 히라가나로 바꾼 글 */
  reading?: (para: number, s: number, e: number) => string
  scroller: RefObject<HTMLDivElement | null>
  state: AppState
  flash: (t: string) => void
}

const EDGE = 56
const MOVED = 8

/** 한 점에서 가장 가까운 글자 조각. 줄 사이 빈틈에 닿아도 위아래로 조금 더듬어 찾는다. */
function hit(x: number, y: number) {
  for (const dy of [0, -8, 8, -16, 16]) {
    const el = document.elementFromPoint(x, y + dy)?.closest<HTMLElement>('[data-s]')
    if (el) return { para: Number(el.dataset.p), s: Number(el.dataset.s), e: Number(el.dataset.e) }
  }
  return null
}

const overlaps = (m: Pick<Mark, 'para' | 'start' | 'end'>, para: number, s: number, e: number) => m.para === para && s < m.end && e > m.start

/** 밑줄(펜) 모드, 밑줄 저장, 아래에서 올라오는 질문 패널을 한 번에 다룬다. 일본어와 영어 읽기 화면이 같이 쓴다. */
export function useUnderline(o: Options) {
  const { state, scroller } = o
  const marks = state.marks[o.articleId] ?? []
  const [pen, setPenState] = useState(false)
  const [drag, setDrag] = useState<Range | null>(null)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const dragRef = useRef<{ from: Range; x: number; y: number; moved: boolean; last: { x: number; y: number }; raf: number } | null>(null)
  const pushed = useRef(false)

  // 안드로이드 뒤로가기 버튼으로 패널부터 닫는다.
  useEffect(() => {
    const onPop = () => {
      pushed.current = false
      setSheetId(null)
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])
  const open = useCallback((id: string) => {
    if (!pushed.current) {
      history.pushState(history.state, '')
      pushed.current = true
    }
    setSheetId(id)
  }, [])
  const close = useCallback(() => {
    if (pushed.current) history.back()
    else setSheetId(null)
  }, [])

  const markAt = (para: number, s: number, e: number) => [...marks].reverse().find((m) => overlaps(m, para, s, e))

  const create = (r: Range) => {
    const text = o.texts[r.para]?.slice(r.s, r.e).trim()
    if (!text) return
    const m: Mark = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, para: r.para, start: r.s, end: r.e, text, at: Date.now() }
    update((s) => addMark(s, o.articleId, m))
    navigator.vibrate?.(20)
    o.flash('밑줄을 그었어요. 눌러서 물어봐요')
  }

  /** 지금 손가락 위치까지의 구간. 같은 문단 안에서만 이어지고, 다른 문단으로 넘어가면 문단 끝까지 잡는다. */
  const rangeTo = (pt: { x: number; y: number }) => {
    const d = dragRef.current
    const h = d && hit(pt.x, pt.y)
    if (!d || !h) return null
    let { s, e } = h
    if (h.para !== d.from.para) {
      const atoms = scroller.current?.querySelectorAll<HTMLElement>(`[data-p="${d.from.para}"]`)
      if (!atoms?.length) return null
      s = Number(h.para > d.from.para ? atoms[atoms.length - 1].dataset.e : atoms[0].dataset.s)
      e = s
    }
    return { para: d.from.para, s: Math.min(d.from.s, s), e: Math.max(d.from.e, e) }
  }

  const stop = () => {
    if (dragRef.current) cancelAnimationFrame(dragRef.current.raf)
    dragRef.current = null
    setDrag(null)
  }
  useEffect(() => stop, [])

  // 끄는 동안 화면 위·아래 가장자리에 닿으면 글이 저절로 스크롤된다.
  const tick = () => {
    const d = dragRef.current
    const box = scroller.current
    if (!d || !box) return
    const r = box.getBoundingClientRect()
    const y = d.last.y
    const dist = y < r.top + EDGE ? r.top + EDGE - y : y > r.bottom - EDGE ? y - (r.bottom - EDGE) : 0
    if (dist > 0) {
      box.scrollBy(0, (y < r.top + EDGE ? -1 : 1) * Math.min(18, 2 + dist / 5))
      const next = rangeTo(d.last)
      if (next && d.moved) setDrag(next)
    }
    d.raf = requestAnimationFrame(tick)
  }

  const bind = pen
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          const from = hit(e.clientX, e.clientY)
          if (!from) return
          e.currentTarget.setPointerCapture?.(e.pointerId)
          dragRef.current = { from, x: e.clientX, y: e.clientY, moved: false, last: { x: e.clientX, y: e.clientY }, raf: 0 }
          dragRef.current.raf = requestAnimationFrame(tick)
        },
        onPointerMove: (e: React.PointerEvent) => {
          const d = dragRef.current
          if (!d) return
          d.last = { x: e.clientX, y: e.clientY }
          if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > MOVED) d.moved = true
          if (d.moved) setDrag(rangeTo(d.last))
        },
        onPointerUp: (e: React.PointerEvent) => {
          const d = dragRef.current
          if (!d) return
          const end = rangeTo({ x: e.clientX, y: e.clientY })
          const moved = d.moved
          const from = d.from
          stop()
          if (moved && end) create(end)
          else if (!moved) {
            const m = markAt(from.para, from.s, from.e)
            if (m) open(m.id)
          }
        },
        onPointerCancel: stop,
        onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
      }
    : {}

  const setPen = (on: boolean) => {
    stop()
    setPenState(on)
    if (on) o.flash('펜을 켰어요. 글을 쭉 끌어 보세요')
  }

  /* ---- 글자 조각을 그리는 도구 ---- */
  const attrs = (para: number, s: number, e: number) => ({ 'data-p': para, 'data-s': s, 'data-e': e })
  const cls = (para: number, s: number, e: number) => {
    const dragged = drag && overlaps({ para: drag.para, start: drag.s, end: drag.e }, para, s, e)
    return dragged ? 'ul drag' : marks.some((m) => overlaps(m, para, s, e)) ? 'ul' : ''
  }
  /** 밑줄 끝에 대화 수를 작게 보여 준다. */
  const badge = (para: number, e: number): ReactNode => {
    const m = marks.find((x) => x.para === para && x.end === e && (state.chats[x.id]?.length ?? 0) > 0)
    return m ? <span className="ulbadge" aria-label={`질문 ${state.chats[m.id].length}개`}>{state.chats[m.id].filter((c) => c.role === 'user').length}</span> : null
  }
  /** 글(text)을 글자마다 한 조각씩 그린다. 밑줄은 이 조각 단위로 칠한다. */
  const chars = (text: string, start: number, para: number): ReactNode[] => {
    const out: ReactNode[] = []
    let at = start
    for (const ch of text) {
      const e = at + ch.length
      out.push(
        <span key={at} className={cls(para, at, e)} {...attrs(para, at, e)}>
          {ch}
          {badge(para, e)}
        </span>,
      )
      at = e
    }
    return out
  }

  /** 단어 말풍선에서 "밑줄 질문"을 열 때 쓴다: 그 단어 위치를 덮는 밑줄 */
  const markFor = (para: number, s: number, e: number) => markAt(para, s, e)

  const sheetMark = sheetId ? marks.find((m) => m.id === sheetId) : null

  const penButton = (
    <button className={`penbtn ${pen ? 'on' : ''}`} type="button" aria-pressed={pen} onClick={() => setPen(!pen)}>
      <Icon name="pen" />밑줄 펜
    </button>
  )

  const sheet = sheetMark ? (
    <AskSheet
      key={sheetMark.id}
      articleId={o.articleId}
      title={o.title}
      lang={o.lang}
      mark={sheetMark}
      paragraph={o.texts[sheetMark.para] ?? ''}
      reading={o.reading}
      messages={state.chats[sheetMark.id] ?? []}
      onClose={close}
    />
  ) : null

  return { pen, setPen, penButton, sheet, bind, attrs, cls, chars, badge, markFor, open }
}
