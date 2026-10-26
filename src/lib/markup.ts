import { ARTICLES } from '../data/articles'

export interface Token {
  /** 표기 */
  surface: string
  reading: string
  meaning: string
  /** 활용 어미처럼 뒤에 붙는 가나 */
  tail: string
}

export type Piece = { text: string } | { token: Token }

const TOKEN = /\{([^|}]*)\|([^|}]*)\|([^|}]*)(?:\|([^}]*))?\}/g

export function parse(src: string): Piece[] {
  const out: Piece[] = []
  let last = 0
  for (const m of src.matchAll(TOKEN)) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) })
    out.push({ token: { surface: m[1], reading: m[2], meaning: m[3], tail: m[4] ?? '' } })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ text: src.slice(last) })
  return out
}

export const plain = (src: string) =>
  parse(src)
    .map((p) => ('text' in p ? p.text : p.token.surface + p.token.tail))
    .join('')

export const tokenKey = (t: Token) => t.surface + t.tail

/** 단어장에 저장하는 읽기: 어미까지 포함 */
export const tokenReading = (t: Token) => (t.reading ? t.reading + t.tail : '')

export interface GlossWord {
  key: string
  reading: string
  meaning: string
}

/** 모든 글에 나온 단어(퀴즈 보기 만들 때 쓴다) */
export function wordsOf(paragraphs: string[]): GlossWord[] {
  const seen = new Map<string, GlossWord>()
  for (const p of paragraphs) {
    for (const piece of parse(p)) {
      if ('token' in piece) {
        const t = piece.token
        seen.set(tokenKey(t), { key: tokenKey(t), reading: tokenReading(t), meaning: t.meaning })
      }
    }
  }
  return [...seen.values()]
}

export const ALL_WORDS: GlossWord[] = wordsOf(ARTICLES.flatMap((a) => a.paragraphs))

export const charCount = (paragraphs: string[]) => paragraphs.map(plain).join('').length
