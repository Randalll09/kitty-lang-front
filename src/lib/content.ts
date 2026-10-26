import { ARTICLES } from '../data/articles'
import { ARTICLES_EN } from '../data/articles.en'
import { charCount, plain } from './markup'
import type { Lang } from '../types'

/** 글 고르기 화면이 두 언어를 같은 모양으로 다루기 위한 목록 항목 */
export interface ListItem {
  id: string
  title: string
  kr: string
  topic: string
  level: string
  minutes: number
  /** 크기 표시: 일본어는 글자 수, 영어는 단어 수 */
  size: string
}

export const LANG_NAME: Record<Lang, string> = { ja: '일본어', en: '영어' }
export const LANG_LEVELS: Record<Lang, string[]> = { ja: ['입문', '초급'], en: ['입문', '초급'] }
export const LANG_TOPICS: Record<Lang, string[]> = { ja: ['뉴스', '일상', '문화'], en: ['고양이', '닌텐도', '꽃'] }

/** 영어 글은 단어 수가 짧은 순서로 정렬돼 있고, 목록에서도 그 순서를 유지한다. */
export function listArticles(lang: Lang): ListItem[] {
  if (lang === 'en') {
    return ARTICLES_EN.map((a) => ({ id: a.id, title: a.title, kr: a.kr, topic: a.topic, level: a.level, minutes: a.minutes, size: `${a.words}단어` }))
  }
  return ARTICLES.map((a) => ({
    id: a.id,
    title: plain(a.title),
    kr: a.kr,
    topic: a.topic,
    level: a.level,
    minutes: a.minutes,
    size: `약 ${Math.round(charCount(a.paragraphs) / 10) * 10}자`,
  }))
}

export const hasArticle = (lang: Lang, id: string) => (lang === 'en' ? ARTICLES_EN : ARTICLES).some((a) => a.id === id)
export const firstArticleId = (lang: Lang) => (lang === 'en' ? ARTICLES_EN : ARTICLES)[0].id
