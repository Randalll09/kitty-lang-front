export type Level = '입문' | '초급'
export type Topic = '뉴스' | '일상' | '문화'
export type Theme = 'system' | 'light' | 'dark'
export type Lang = 'ja' | 'en'
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
  /** 단어가 나온 문장. 뜻이 비어 있는 단어(뜻풀이 없는 글)를 나중에 채울 때 보여 준다. */
  context?: string
  /** 0 새 단어, 1 익히는 중, 2 외웠어요 */
  box: 0 | 1 | 2
  /** 어느 학습 언어의 단어인지. 없으면 예전에 저장한 일본어 단어다. */
  lang?: Lang
  /** 다음 복습일 YYYY-MM-DD */
  due: string
  addedAt: number
}

export interface DayLog {
  tasks: Partial<Record<TaskId, true>>
  /** 그날 읽은 글, 복습한 단어, 퀴즈 맞힌 수/푼 수. 서버에 올리는 숫자들이다. */
  articles?: number
  reviewed?: number
  quizCorrect?: number
  quizTotal?: number
}

/** 읽기 화면에서 펜으로 그은 밑줄. start/end는 문단 글자(plain) 기준 위치. */
export interface Mark {
  id: string
  para: number
  start: number
  end: number
  text: string
  at: number
}

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  at: number
}

export interface Settings {
  furigana: boolean
  fontIndex: number
  theme: Theme
}

/** 언어마다 따로 쌓는 기록. 일본어는 예전 저장 구조 그대로 AppState 바로 아래에, 영어는 AppState.en에 둔다. */
export interface LangRecord {
  lastArticle: string | null
  days: Record<string, DayLog>
  articlesRead: number
  reviewedTotal: number
  quizCorrect: number
  quizTotal: number
}

export interface AppState extends LangRecord {
  version: 1
  /** 지금 배우는 언어 */
  lang: Lang
  words: Record<string, VocabEntry>
  /** 글 id → 읽기 진행(0~100) */
  progress: Record<string, number>
  bookmarks: string[]
  /** 글 id → 밑줄 */
  marks: Record<string, Mark[]>
  /** 밑줄 id → Claude와 나눈 대화 */
  chats: Record<string, ChatMsg[]>
  snacks: number
  /** 영어 기록 */
  en: LangRecord
  settings: Settings
}
