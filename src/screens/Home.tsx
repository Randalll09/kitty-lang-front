import { Cat } from '../components/Cat'
import { Icon } from '../components/Icon'
import { ARTICLES } from '../data/articles'
import { DAILY_GOAL, TASK_MINUTES, dueWords, minutesToday, streak, tasksToday } from '../lib/store'
import type { Screen } from '../App'
import type { AppState, TaskId } from '../types'

export function Home({ state, go }: { state: AppState; go: (s: Screen) => void }) {
  const minutes = minutesToday(state)
  const tasks = tasksToday(state)
  // 하루 완료는 30분이 아니라 독해(글 읽기)를 끝냈는지로 정한다.
  const done = !!tasks.read
  const due = dueWords(state).length
  const saved = Object.keys(state.words).length
  const next = ARTICLES.find((a) => (state.progress[a.id] ?? 0) < 100) ?? ARTICLES[0]
  const accuracy = state.quizTotal ? Math.round((state.quizCorrect / state.quizTotal) * 100) : null

  const quests: { id: TaskId; title: string; sub: string; to: Screen }[] = [
    { id: 'review', title: '단어 복습', sub: due ? `복습할 단어 ${due}개` : '복습할 단어가 아직 없어요', to: { name: 'vocab', tab: 'review' } },
    { id: 'read', title: '글 한 편 읽기', sub: next.kr, to: { name: 'pick' } },
    { id: 'quiz', title: '퀴즈 풀기', sub: '글 하나당 4문제', to: { name: 'quiz' } },
    { id: 'words', title: '새 단어 확인', sub: `저장한 단어 ${saved}개`, to: { name: 'vocab', tab: 'list' } },
  ]

  const bubble = done ? '오늘 독해 끝! 쿨쿨…' : minutes >= 20 ? '거의 다 했어요!' : '오늘은 글 한 편만 같이 읽어요'

  return (
    <div className="body">
      <div className="top">
        <span className="chip lang">일본어</span>
        <div className="r">
          <span className="chip fire">연속 {streak(state)}일</span>
          <span className="chip coin">간식 {state.snacks}</span>
          <button className="iconbtn gearbtn" type="button" aria-label="설정" onClick={() => go({ name: 'settings' })}><Icon name="gear" /></button>
        </div>
      </div>

      <div className="card room">
        <div className="wall" />
        <div className="floor" />
        <div className="win"><i /><i /><i /><i /></div>
        <div className="rug" />
        <div className="bubble">{bubble}</div>
        <Cat pose={done ? 'sleep' : 'sit'} scale={1.4} />
      </div>

      <div className="card goal">
        <div className="row">
          <h2>오늘의 학습 시간</h2>
          <span className="big">{minutes} / {DAILY_GOAL}분</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={DAILY_GOAL} aria-valuenow={minutes}>
          <b style={{ width: `${Math.min(100, (minutes / DAILY_GOAL) * 100)}%` }} data-zero={minutes === 0 || undefined} />
        </div>
      </div>

      <div className="quest">
        {quests.map((q) => (
          <button key={q.id} type="button" className={`q ${tasks[q.id] ? 'done' : ''}`} onClick={() => go(q.to)}>
            <span className="ck"><Icon name="check" /></span>
            <span className="t">{q.title}<span className="sub">{q.sub}</span></span>
            <span className="xp">{TASK_MINUTES[q.id]}분</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="top" style={{ marginBottom: 10 }}>
          <h2>내 기록</h2>
          <button className="btn ghost sm" type="button" onClick={() => go({ name: 'cal' })}>달력 보기</button>
        </div>
        <div className="mystats">
          <div><b>{minutes}분</b><span>오늘 학습 시간</span></div>
          <div><b>{state.articlesRead}편</b><span>읽은 글</span></div>
          <div><b>{state.reviewedTotal}개</b><span>복습 단어</span></div>
          <div><b>{streak(state)}일</b><span>연속 일수</span></div>
          <div><b>{accuracy === null ? '-' : `${accuracy}%`}</b><span>정답률</span></div>
          <div><b>{saved}개</b><span>저장한 단어</span></div>
        </div>
      </div>
    </div>
  )
}
