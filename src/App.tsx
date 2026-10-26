import { useCallback, useEffect, useRef, useState } from 'react'
import { firstArticleId, hasArticle } from './lib/content'
import { rec, useAppState } from './lib/store'
import { NavBar } from './components/NavBar'
import { Home } from './screens/Home'
import { Pick } from './screens/Pick'
import { Read } from './screens/Read'
import { ReadEn } from './screens/ReadEn'
import { Quiz } from './screens/Quiz'
import { Vocab } from './screens/Vocab'
import { Settings } from './screens/Settings'
import { Calendar } from './screens/Calendar'
import { Together } from './screens/Together'
import { sync } from './lib/social'
import { supabase } from './lib/supabase'

export type Screen =
  | { name: 'home' }
  | { name: 'pick' }
  | { name: 'read'; id: string }
  | { name: 'quiz'; id?: string }
  | { name: 'vocab'; tab?: 'list' | 'review' }
  | { name: 'cal' }
  | { name: 'together' }
  | { name: 'settings' }

export default function App() {
  const state = useAppState()
  const [screen, setScreen] = useState<Screen>(() => (history.state as Screen | null) ?? { name: 'home' })

  // 안드로이드 뒤로가기 버튼이 화면 단위로 동작하도록 브라우저 기록을 쓴다.
  const go = useCallback((next: Screen) => {
    history.pushState(next, '')
    setScreen(next)
  }, [])
  useEffect(() => {
    history.replaceState(screen, '')
    const onPop = (e: PopStateEvent) => setScreen((e.state as Screen | null) ?? { name: 'home' })
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (state.settings.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = state.settings.theme
  }, [state.settings.theme])

  // 학습 언어에 따라 포인트 색이 달라진다.
  useEffect(() => {
    document.documentElement.dataset.lang = state.lang
  }, [state.lang])

  // 로컬 기록이 바뀌면 잠시 뒤 서버에 올리고, 앱을 열거나 인터넷이 돌아오거나 1분마다 한 번 더 맞춘다.
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    if (!supabase) return
    const t = setTimeout(() => void sync(latest.current), 3000)
    return () => clearTimeout(t)
  }, [state.days, state.en.days])
  useEffect(() => {
    if (!supabase) return
    const now = () => void sync(latest.current)
    now()
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(now, 0))
    const visible = () => document.visibilityState === 'visible' && now()
    addEventListener('online', now)
    document.addEventListener('visibilitychange', visible)
    const id = setInterval(visible, 60_000)
    return () => {
      data.subscription.unsubscribe()
      removeEventListener('online', now)
      document.removeEventListener('visibilitychange', visible)
      clearInterval(id)
    }
  }, [])

  const back = () => history.back()
  // 뒤로가기로 다른 언어의 글 화면이 다시 나오면 홈을 보여 준다.
  const stale = (screen.name === 'read' || (screen.name === 'quiz' && screen.id)) && !hasArticle(state.lang, screen.id!)
  const last = rec(state).lastArticle
  const quizId = screen.name === 'quiz' ? (screen.id ?? (last && hasArticle(state.lang, last) ? last : firstArticleId(state.lang))) : ''
  const view = stale ? { name: 'home' as const } : screen

  return (
    <div className="app">
      {view.name === 'home' && <Home state={state} go={go} />}
      {view.name === 'pick' && <Pick key={state.lang} state={state} go={go} />}
      {view.name === 'read' && state.lang === 'ja' && <Read key={view.id} state={state} id={view.id} go={go} back={back} />}
      {view.name === 'read' && state.lang === 'en' && <ReadEn key={view.id} state={state} id={view.id} go={go} back={back} />}
      {view.name === 'quiz' && <Quiz key={`${state.lang}-${quizId}`} state={state} id={quizId} go={go} />}
      {view.name === 'vocab' && <Vocab key={state.lang} state={state} initialTab={view.tab} />}
      {view.name === 'cal' && <Calendar state={state} />}
      {view.name === 'together' && <Together state={state} />}
      {view.name === 'settings' && <Settings state={state} go={go} />}
      {view.name !== 'read' && <NavBar active={view.name} go={go} />}
    </div>
  )
}
