export type Level = '입문' | '초급'
export type Topic = '뉴스' | '일상' | '문화'
export type Theme = 'system' | 'light' | 'dark'
export type TaskId = 'review' | 'read' | 'quiz' | 'words'

export interface QuizSeed {
  kind: string
  ask: string
  stem: string
  /** 첫 번째 보기가 정답. 화면에 보여 줄 때 섞는다. */
  opts: [string, string, string, string]
  exp: string
}

export interface Article {
  id: string
  title: string
  kr: string
  topic: Topic
  level: Level
  /** 읽는 데 걸리는 대략의 시간(분) */
  minutes: number
  paragraphs: string[]
  quiz: QuizSeed[]
}

export interface VocabEntry {
  /** 표기 + 뒤에 붙는 가나. 단어장의 키로도 쓴다. */
  key: string
  reading: string
  meaning: string
  source: string
  /** 0 새 단어, 1 익히는 중, 2 외웠어요 */
  box: 0 | 1 | 2
  /** 다음 복습일 YYYY-MM-DD */
  due: string
  addedAt: number
}

export interface DayLog {
  tasks: Partial<Record<TaskId, true>>
}

export interface Settings {
  furigana: boolean
  fontIndex: number
  theme: Theme
}

export interface AppState {
  version: 1
  words: Record<string, VocabEntry>
  /** 글 id → 읽기 진행(0~100) */
  progress: Record<string, number>
  bookmarks: string[]
  lastArticle: string | null
  days: Record<string, DayLog>
  snacks: number
  articlesRead: number
  reviewedTotal: number
  quizCorrect: number
  quizTotal: number
  settings: Settings
}
