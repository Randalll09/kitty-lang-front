import { useEffect, useMemo, useRef, useState } from 'react'
import { Cat } from '../components/Cat'
import { Icon } from '../components/Icon'
import { ARTICLES } from '../data/articles'
import { buildQuiz } from '../lib/quiz'
import { wordsOf } from '../lib/markup'
import { addToday, completeTask, saveWord, update } from '../lib/store'
import type { Screen } from '../App'
import type { AppState } from '../types'
import type { GlossWord } from '../lib/markup'

export function Quiz({ state, id, go }: { state: AppState; id: string; go: (s: Screen) => void }) {
  const article = ARTICLES.find((a) => a.id === id) ?? ARTICLES[0]
  const [round, setRound] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questions = useMemo(() => buildQuiz(article, wordsOf(article.paragraphs)), [article, round])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState<GlossWord[]>([])
  const [added, setAdded] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const reported = useRef(false)

  const over = index >= questions.length
  const q = questions[index]

  useEffect(() => {
    if (!over || reported.current) return
    reported.current = true
    update((s) =>
      completeTask(
        addToday({ ...s, quizCorrect: s.quizCorrect + score, quizTotal: s.quizTotal + questions.length }, { quizCorrect: score, quizTotal: questions.length }),
        'quiz',
      ),
    )
  }, [over, score, questions.length])

  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [index])

  const answer = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    if (i === q.answer) setScore((n) => n + 1)
    else if (q.word) setWrong((w) => [...w, q.word!])
    setTimeout(() => body.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 50)
  }

  const retry = () => {
    reported.current = false
    setRound((r) => r + 1)
    setIndex(0)
    setPicked(null)
    setScore(0)
    setWrong([])
    setAdded(false)
  }

  const addWrong = () => {
    update((s) => wrong.reduce((acc, w) => saveWord(acc, { key: w.key, reading: w.reading, meaning: w.meaning, source: '퀴즈' }), s))
    setAdded(true)
  }

  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0
  const newWrong = wrong.filter((w) => !state.words[w.key])

  return (
    <>
      <div className="qtop">
        <button className="iconbtn" type="button" aria-label="홈으로" onClick={() => go({ name: 'home' })}><Icon name="back" /></button>
        <div className="pbar"><b style={{ width: `${(Math.min(index, questions.length) / questions.length) * 100}%` }} /></div>
        <span className="n">{over ? '끝' : `${index + 1}/${questions.length}`}</span>
      </div>
      <div className="body" ref={body}>
        {over ? (
          <>
            <div className="card res qcard" style={{ alignItems: 'center' }}>
              <Cat pose="happy" scale={1.2} />
              <h2>퀴즈 끝!</h2>
              <div className="big">{score} / {questions.length}</div>
              <div className="nums">
                <div><b>{pct}%</b><span>정답률</span></div>
                <div><b>{questions.length}</b><span>푼 문제</span></div>
                <div><b>{wrong.length}</b><span>틀린 단어</span></div>
              </div>
            </div>
            <button className="btn mint block" type="button" disabled={added || newWrong.length === 0} onClick={addWrong}>
              {added ? '담았어요' : newWrong.length ? `틀린 단어 ${newWrong.length}개 단어장에 담기` : '새로 담을 틀린 단어가 없어요'}
            </button>
            <button className="btn peach block" type="button" onClick={() => go({ name: 'vocab', tab: 'review' })}>단어장으로 가기</button>
            <button className="btn ghost block" type="button" onClick={retry}>다시 풀기</button>
          </>
        ) : (
          <>
            <span className="tag qkind">{q.kind} · {article.kr}</span>
            <div className="card qcard">
              <span className="ask">{q.ask}</span>
              <div className={`stem ${q.small ? 'sm' : ''}`}>{q.stem}</div>
            </div>
            <div className="opts">
              {q.opts.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  className={`opt ${picked !== null && i === q.answer ? 'ok' : ''} ${picked === i && i !== q.answer ? 'ng' : ''}`}
                  disabled={picked !== null}
                  onClick={() => answer(i)}
                >
                  <span className="k">{'ABCD'[i]}</span>{o}
                </button>
              ))}
            </div>
            {picked !== null && (
              <>
                <div className="fb">
                  <Cat pose={picked === q.answer ? 'happy' : 'sit'} scale={0.6} />
                  <div><b>{picked === q.answer ? '정답이에요' : '아쉬워요'}</b>{q.exp}</div>
                </div>
                <button
                  className="btn peach block"
                  type="button"
                  onClick={() => {
                    setIndex((n) => n + 1)
                    setPicked(null)
                  }}
                >
                  {index === questions.length - 1 ? '결과 보기' : '다음 문제'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
