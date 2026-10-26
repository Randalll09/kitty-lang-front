import { Icon } from './Icon'
import type { Screen } from '../App'

const ITEMS = [
  ['home', '홈', 'home'],
  ['pick', '글', 'list'],
  ['quiz', '퀴즈', 'quiz'],
  ['vocab', '단어장', 'cards'],
  ['settings', '설정', 'gear'],
] as const

export function NavBar({ active, go }: { active: Screen['name']; go: (s: Screen) => void }) {
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
        </button>
      ))}
    </nav>
  )
}
