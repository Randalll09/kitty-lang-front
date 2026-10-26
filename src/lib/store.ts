import { useSyncExternalStore } from 'react'
import { addDays, today } from './dates'
import type { AppState, TaskId, VocabEntry } from '../types'

const KEY = 'kitty-lang-v1'

export const DAILY_GOAL = 30
export const TASK_MINUTES: Record<TaskId, number> = { review: 5, read: 12, quiz: 8, words: 5 }
export const FONT_SIZES = [14, 15, 16, 18, 20]

const initial = (): AppState => ({
  version: 1,
  words: {},
  progress: {},
  bookmarks: [],
  lastArticle: null,
  days: {},
  snacks: 0,
  articlesRead: 0,
  reviewedTotal: 0,
  quizCorrect: 0,
  quizTotal: 0,
  settings: { furigana: true, fontIndex: 2, theme: 'system' },
})

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initial()
    const saved = JSON.parse(raw) as Partial<AppState>
    const base = initial()
    return { ...base, ...saved, settings: { ...base.settings, ...saved.settings } }
  } catch {
    return initial()
  }
}

let state = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 저장 공간이 막혀 있어도 앱은 계속 쓸 수 있다.
  }
}

export function update(fn: (s: AppState) => AppState) {
  state = fn(state)
  persist()
  listeners.forEach((l) => l())
}

export function useAppState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export const resetAll = () => update(() => initial())

/* ---------- 오늘 기록 ---------- */

export const tasksToday = (s: AppState) => s.days[today()]?.tasks ?? {}

export function minutesOn(s: AppState, day: string) {
  const tasks = s.days[day]?.tasks ?? {}
  return (Object.keys(tasks) as TaskId[]).reduce((a, t) => a + TASK_MINUTES[t], 0)
}

export const minutesToday = (s: AppState) => minutesOn(s, today())

/** 하루에 하나라도 했으면 이어진 날로 센다. 오늘 아직 안 했으면 어제까지 센다. */
export function streak(s: AppState) {
  let day = today()
  if (minutesOn(s, day) === 0) day = addDays(day, -1)
  let n = 0
  while (minutesOn(s, day) > 0) {
    n++
    day = addDays(day, -1)
  }
  return n
}

export function completeTask(s: AppState, id: TaskId): AppState {
  const d = today()
  const log = s.days[d] ?? { tasks: {} }
  if (log.tasks[id]) return s
  return { ...s, days: { ...s.days, [d]: { tasks: { ...log.tasks, [id]: true } } } }
}

/* ---------- 단어 ---------- */

export function saveWord(s: AppState, w: Pick<VocabEntry, 'key' | 'reading' | 'meaning' | 'source'>): AppState {
  if (s.words[w.key]) return s
  const entry: VocabEntry = { ...w, box: 0, due: today(), addedAt: Date.now() }
  return { ...s, words: { ...s.words, [w.key]: entry } }
}

export function removeWord(s: AppState, key: string): AppState {
  const { [key]: _, ...rest } = s.words
  return { ...s, words: rest }
}

/** 복습 간격(일): 새 단어 → 1, 익히는 중 → 3, 외웠어요 → 7 */
const INTERVALS = [1, 3, 7]

export function gradeWord(s: AppState, key: string, knew: boolean): AppState {
  const w = s.words[key]
  if (!w) return s
  const box = (knew ? Math.min(2, w.box + 1) : w.box) as VocabEntry['box']
  const due = knew ? addDays(today(), INTERVALS[box]) : today()
  const next: AppState = { ...s, words: { ...s.words, [key]: { ...w, box, due } } }
  return knew ? { ...next, snacks: next.snacks + 1, reviewedTotal: next.reviewedTotal + 1 } : next
}

export const dueWords = (s: AppState) =>
  Object.values(s.words)
    .filter((w) => w.due <= today())
    .sort((a, b) => a.box - b.box || a.addedAt - b.addedAt)
