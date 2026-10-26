import type { Article } from '../types'
import { ALL_WORDS, type GlossWord } from './markup'

export interface Question {
  kind: string
  ask: string
  stem: string
  small?: boolean
  opts: string[]
  answer: number
  exp: string
  /** 틀렸을 때 단어장에 담을 단어 */
  word?: GlossWord
}

const shuffle = <T,>(a: T[]) => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

const hasKanji = (s: string) => /[一-龯]/.test(s)

function withOptions(right: string, pool: string[]) {
  const wrong = shuffle([...new Set(pool)].filter((p) => p !== right)).slice(0, 3)
  const opts = shuffle([right, ...wrong])
  return { opts, answer: opts.indexOf(right) }
}

/** 글에 나온 단어로 읽기·뜻 문제를, 글에 딸린 문제로 빈칸·내용 문제를 만든다. */
export function buildQuiz(article: Article, articleWords: GlossWord[]): Question[] {
  const out: Question[] = []

  const readable = shuffle(articleWords.filter((w) => hasKanji(w.key) && w.reading))
  const r = readable[0]
  if (r) {
    out.push({
      kind: '읽기',
      ask: '읽는 방법을 고르세요',
      stem: r.key,
      ...withOptions(r.reading, ALL_WORDS.filter((w) => w.reading).map((w) => w.reading)),
      exp: `${r.key}(${r.reading})는 ${r.meaning}이에요.`,
      word: r,
    })
  }

  const meaningful = shuffle(articleWords.filter((w) => w.meaning && w.key !== r?.key))
  const m = meaningful[0]
  if (m) {
    out.push({
      kind: '뜻',
      ask: '뜻을 고르세요',
      stem: m.key,
      ...withOptions(m.meaning, ALL_WORDS.map((w) => w.meaning)),
      exp: `${m.key}${m.reading ? `(${m.reading})` : ''}는 ${m.meaning}이에요.`,
      word: m,
    })
  }

  for (const q of article.quiz) {
    const right = q.opts[0]
    const opts = shuffle([...q.opts])
    const found = articleWords.find((w) => w.key === right)
    out.push({
      kind: q.kind,
      ask: q.ask,
      stem: q.stem,
      small: true,
      opts,
      answer: opts.indexOf(right),
      exp: q.exp,
      word: q.kind === '빈칸' ? found : undefined,
    })
  }
  return out
}
