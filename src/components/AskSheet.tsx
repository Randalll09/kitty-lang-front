import { Fragment, useEffect, useRef, useState } from 'react'
import { askClaude, type AskResult } from '../lib/ask'
import { appendChat, removeMark, update } from '../lib/store'
import type { ChatMsg, Lang, Mark } from '../types'

interface Props {
  articleId: string
  title: string
  lang: Lang
  mark: Mark
  paragraph: string
  reading?: (para: number, s: number, e: number) => string
  messages: ChatMsg[]
  onClose: () => void
}

const QUICK: Record<Lang, string[]> = {
  ja: ['이 문장 뜻을 쉽게 풀어줘', '단어를 하나씩 설명해줘', '비슷한 예문을 보여줘'],
  en: ['이 문장 뜻을 쉽게 풀어줘', '단어를 하나씩 설명해줘', '비슷한 예문을 보여줘'],
}

/** 답변 속 **굵게**만 살리고 나머지는 글 그대로 보여 준다. */
function Answer({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i}>
          {line.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : <Fragment key={j}>{part}</Fragment>))}
        </p>
      ))}
    </>
  )
}

const catSrc = `${import.meta.env.BASE_URL}cat/sit.webp`

/** 밑줄을 누르면 아래에서 올라오는 질문 채팅 패널. 선택한 문장이 맥락으로 붙은 채 Claude에게 물어본다. */
export function AskSheet({ articleId, title, lang, mark, paragraph, reading, messages, onClose }: Props) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<Extract<AskResult, { ok: false }> | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, busy, err])

  const ctx = {
    lang,
    title,
    selection: mark.text,
    selectionReading: lang === 'ja' && reading ? reading(mark.para, mark.start, mark.end) : undefined,
    paragraph,
    paragraphReading: lang === 'ja' && reading ? reading(mark.para, 0, paragraph.length) : undefined,
  }

  const ask = async (history: ChatMsg[]) => {
    setBusy(true)
    setErr(null)
    // 서버는 사용자 질문으로 시작하는 최근 대화만 받는다.
    const recent = history.slice(-10)
    const first = recent.findIndex((m) => m.role === 'user')
    const res = await askClaude(ctx, recent.slice(Math.max(0, first)).map(({ role, content }) => ({ role, content })))
    setBusy(false)
    if (res.ok) {
      setRemaining(res.remaining)
      update((s) => appendChat(s, mark.id, { role: 'assistant', content: res.answer, at: Date.now() }))
    } else setErr(res)
  }

  const send = (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const msg: ChatMsg = { role: 'user', content: q.slice(0, 500), at: Date.now() }
    update((s) => appendChat(s, mark.id, msg))
    void ask([...messages, msg])
  }

  const lastIsQuestion = messages.length > 0 && messages[messages.length - 1].role === 'user'

  const del = () => {
    if (!confirmDel) return setConfirmDel(true)
    onClose()
    update((s) => removeMark(s, articleId, mark.id))
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-label="밑줄 질문">
        <div className="grab" />
        <div className="shead">
          <img className="ava" src={catSrc} alt="" aria-hidden="true" draggable={false} />
          <div className="t">고양이 선생님께 물어보기</div>
          <button className="iconbtn" type="button" aria-label="닫기" onClick={onClose}>✕</button>
        </div>
        <blockquote className="quote" lang={lang}>
          <small>밑줄 친 부분</small>
          {mark.text}
        </blockquote>

        <div className="chat" aria-live="polite">
          {messages.length === 0 && !busy && (
            <div className="qchips">
              {QUICK[lang].map((q) => (
                <button key={q} className="qchip" type="button" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="me">{m.content}</div>
            ) : (
              <div key={i} className="ai">
                <img className="ava" src={catSrc} alt="" aria-hidden="true" draggable={false} />
                <div className="b"><Answer text={m.content} /></div>
              </div>
            ),
          )}
          {busy && (
            <div className="ai">
              <img className="ava" src={catSrc} alt="" aria-hidden="true" draggable={false} />
              <div className="b dots" role="status" aria-label="답변을 쓰는 중"><i /><i /><i /></div>
            </div>
          )}
          {err && (
            <div className="off" role="alert">
              <p>{err.message}</p>
              {lastIsQuestion && err.reason !== 'limit' && err.reason !== 'login' && (
                <button className="btn sm" type="button" onClick={() => void ask(messages)}>다시 보내기</button>
              )}
            </div>
          )}
          <div ref={end} />
        </div>

        <div className="sfoot">
          {remaining !== null && <span className="quota">오늘 {remaining}번 더 물어볼 수 있어요</span>}
          <button className={`del ${confirmDel ? 'sure' : ''}`} type="button" onClick={del} onBlur={() => setConfirmDel(false)}>
            {confirmDel ? '정말 지울까요?' : '밑줄 지우기'}
          </button>
        </div>
        <form
          className="compose"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <input
            className="inp"
            value={input}
            maxLength={500}
            placeholder="궁금한 걸 적어 보세요"
            aria-label="질문"
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="send" type="submit" aria-label="보내기" disabled={busy || !input.trim()}>➤</button>
        </form>
      </section>
    </>
  )
}
