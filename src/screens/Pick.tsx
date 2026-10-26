import { useState } from 'react'
import { ARTICLES } from '../data/articles'
import { charCount, plain } from '../lib/markup'
import type { Screen } from '../App'
import type { AppState, Level, Topic } from '../types'

const TOPICS: ('전체' | Topic)[] = ['전체', '뉴스', '일상', '문화']
const LEVELS: Level[] = ['입문', '초급']

export function Pick({ state, go }: { state: AppState; go: (s: Screen) => void }) {
  const [level, setLevel] = useState<Level>('입문')
  const [topic, setTopic] = useState<'전체' | Topic>('전체')
  const [sel, setSel] = useState(state.lastArticle ?? ARTICLES[0].id)

  const list = ARTICLES.filter((a) => a.level === level && (topic === '전체' || a.topic === topic))
  const current = list.find((a) => a.id === sel) ?? list[0]

  return (
    <>
      <div className="body">
        <div className="top">
          <h2 style={{ fontSize: 22 }}>글 고르기</h2>
          <span className="chip lang">일본어</span>
        </div>
        <div className="seg" role="group" aria-label="난이도">
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>{l}</button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="주제">
          {TOPICS.map((t) => (
            <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)}>{t}</button>
          ))}
        </div>
        <div className="arts">
          {list.length === 0 && <p className="soft center" style={{ margin: '30px 0' }}>이 조건의 글이 아직 없어요</p>}
          {list.map((a) => {
            const pg = state.progress[a.id] ?? 0
            return (
              <button key={a.id} type="button" className="art" aria-pressed={current?.id === a.id} onClick={() => setSel(a.id)}>
                <span className="jp">{plain(a.title)}</span>
                <span className="kr">{a.kr}</span>
                <span className="meta">
                  <span className="tag">{a.topic}</span>
                  <span>약 {Math.round(charCount(a.paragraphs) / 10) * 10}자 · 약 {a.minutes}분</span>
                  {pg >= 100 ? (
                    <span className="tag done">완료</span>
                  ) : pg > 0 ? (
                    <>
                      <span className="tag ing">읽는 중</span>
                      <span className="mini"><b style={{ width: `${pg}%` }} /></span>
                    </>
                  ) : (
                    <span className="tag new">새 글</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="cta">
        <div className="t">선택한 글<b>{current ? plain(current.title) : ''}</b></div>
        <button className="btn peach" type="button" disabled={!current} onClick={() => current && go({ name: 'read', id: current.id })}>
          읽기 시작
        </button>
      </div>
    </>
  )
}
