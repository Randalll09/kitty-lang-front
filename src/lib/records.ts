import type { AppState, Lang } from '../types'
import { addDays, today } from './dates'
import { minutesOn, rec } from './store'
import type { PartnerDay, SocialState } from './social'

/* 공유 기록 화면용 숫자 계산. 숫자만 다루고 글이나 단어 내용은 건드리지 않는다. */

export type Scope = Lang | 'all'
/** 오늘, 최근 7일, 최근 30일 */
export type Period = 1 | 7 | 30

export interface Totals {
  seconds: number
  articles: number
  reviewed: number
  correct: number
  total: number
  /** 독해를 끝낸 날이 이어진 일수 */
  streak: number
}

const LANGS: Lang[] = ['ja', 'en']
const zero = (): PartnerDay => ({ seconds: 0, articles: 0, reviewed: 0, correct: 0, total: 0 })

const mineDay = (app: AppState, day: string, lang: Lang): PartnerDay => {
  const log = rec(app, lang).days[day]
  return {
    seconds: minutesOn(app, day, lang) * 60,
    articles: log?.articles ?? 0,
    reviewed: log?.reviewed ?? 0,
    correct: Math.min(log?.quizCorrect ?? 0, log?.quizTotal ?? 0),
    total: log?.quizTotal ?? 0,
  }
}

const mineRead = (app: AppState, day: string, lang: Lang) => !!rec(app, lang).days[day]?.tasks.read || (rec(app, lang).days[day]?.articles ?? 0) > 0

function collect(get: (day: string) => PartnerDay, read: (day: string) => boolean, period: Period): Totals {
  const t = today()
  const sum = zero()
  for (let i = 0; i < period; i++) {
    const d = get(addDays(t, -i))
    sum.seconds += d.seconds
    sum.articles += d.articles
    sum.reviewed += d.reviewed
    sum.correct += d.correct
    sum.total += d.total
  }
  // 연속 일수: 오늘 아직 안 읽었으면 어제부터 센다.
  let day = read(t) ? t : addDays(t, -1)
  let streak = 0
  while (read(day) && streak < 400) {
    streak++
    day = addDays(day, -1)
  }
  return { ...sum, streak }
}

const langsOf = (scope: Scope) => (scope === 'all' ? LANGS : [scope])

export function myTotals(app: AppState, scope: Scope, period: Period): Totals {
  const ls = langsOf(scope)
  return collect(
    (day) => ls.reduce((a, l) => add(a, mineDay(app, day, l)), zero()),
    (day) => ls.some((l) => mineRead(app, day, l)),
    period,
  )
}

export function partnerTotals(s: SocialState, scope: Scope, period: Period): Totals {
  const ls = langsOf(scope)
  const at = (l: Lang, day: string) => s.partnerLangDays[l]?.[day]
  return collect(
    (day) => ls.reduce((a, l) => add(a, at(l, day) ?? zero()), zero()),
    (day) => ls.some((l) => (at(l, day)?.articles ?? 0) > 0),
    period,
  )
}

function add(a: PartnerDay, b: PartnerDay): PartnerDay {
  return { seconds: a.seconds + b.seconds, articles: a.articles + b.articles, reviewed: a.reviewed + b.reviewed, correct: a.correct + b.correct, total: a.total + b.total }
}

/** 정답률(%). 푼 문제가 없으면 null. */
export const accuracy = (t: Totals) => (t.total ? Math.round((t.correct / t.total) * 100) : null)
