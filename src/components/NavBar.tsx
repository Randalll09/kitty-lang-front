import { Icon } from './Icon'
import { unreadCheers, useSocial } from '../lib/social'
import type { Screen } from '../App'

const ITEMS = [
  ['home', '홈', 'home'],
  ['pick', '글', 'list'],
  ['quiz', '퀴즈', 'quiz'],
  ['vocab', '단어장', 'cards'],
  ['cal', '기록', 'cal'],
  ['together', '같이', 'paw'],
] as const

export function NavBar({ active, go }: { active: Screen['name']; go: (s: Screen) => void }) {
  const unread = unreadCheers(useSocial())
  return (
    <nav className="nav" aria-label="메뉴">
      {ITEMS.map(([name, label, icon]) => (
        <button
          key={name}
          type="button"
          className={active === name ? 'on' : ''}
          aria-current={active === name ? 'page' : undefined}
          onClick={() => go({ name } as Screen)}
        >
          <Icon name={icon} />
          {label}
          {name === 'together' && unread > 0 && <span className="dot" aria-label={`새 응원 ${unread}개`} />}
        </button>
      ))}
    </nav>
  )
}
