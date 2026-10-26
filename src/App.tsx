import { useCallback, useEffect, useRef, useState } from 'react'
import { ARTICLES } from './data/articles'
import { useAppState } from './lib/store'
import { NavBar } from './components/NavBar'
import { Home } from './screens/Home'
import { Pick } from './screens/Pick'
import { Read } from './screens/Read'
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

  // 로컬 기록이 바뀌면 잠시 뒤 서버에 올리고, 앱을 열거나 인터넷이 돌아오거나 1분마다 한 번 더 맞춘다.
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    if (!supabase) return
    const t = setTimeout(() => void sync(latest.current), 3000)
    return () => clearTimeout(t)
  }, [state.days])
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
  const quizId = screen.name === 'quiz' ? (screen.id ?? state.lastArticle ?? ARTICLES[0].id) : ''

  return (
    <div className="app">
      {screen.name === 'home' && <Home state={state} go={go} />}
      {screen.name === 'pick' && <Pick state={state} go={go} />}
      {screen.name === 'read' && <Read key={screen.id} state={state} id={screen.id} go={go} back={back} />}
      {screen.name === 'quiz' && <Quiz key={quizId} state={state} id={quizId} go={go} />}
      {screen.name === 'vocab' && <Vocab state={state} initialTab={screen.tab} />}
      {screen.name === 'cal' && <Calendar state={state} />}
      {screen.name === 'together' && <Together state={state} />}
      {screen.name === 'settings' && <Settings state={state} go={go} />}
      {screen.name !== 'read' && <NavBar active={screen.name} go={go} />}
    </div>
  )
}
