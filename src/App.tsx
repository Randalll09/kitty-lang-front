import { useCallback, useEffect, useState } from 'react'
import { ARTICLES } from './data/articles'
import { useAppState } from './lib/store'
import { NavBar } from './components/NavBar'
import { Home } from './screens/Home'
import { Pick } from './screens/Pick'
import { Read } from './screens/Read'
import { Quiz } from './screens/Quiz'
import { Vocab } from './screens/Vocab'
import { Settings } from './screens/Settings'

export type Screen =
  | { name: 'home' }
  | { name: 'pick' }
  | { name: 'read'; id: string }
  | { name: 'quiz'; id?: string }
  | { name: 'vocab'; tab?: 'list' | 'review' }
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

  const back = () => history.back()
  const quizId = screen.name === 'quiz' ? (screen.id ?? state.lastArticle ?? ARTICLES[0].id) : ''

  return (
    <div className="app">
      {screen.name === 'home' && <Home state={state} go={go} />}
      {screen.name === 'pick' && <Pick state={state} go={go} />}
      {screen.name === 'read' && <Read key={screen.id} state={state} id={screen.id} go={go} back={back} />}
      {screen.name === 'quiz' && <Quiz key={quizId} state={state} id={quizId} go={go} />}
      {screen.name === 'vocab' && <Vocab state={state} initialTab={screen.tab} />}
      {screen.name === 'settings' && <Settings state={state} />}
      {screen.name !== 'read' && <NavBar active={screen.name} go={go} />}
    </div>
  )
}
