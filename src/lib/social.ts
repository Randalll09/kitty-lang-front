import { useSyncExternalStore } from 'react'
import { addDays, today } from './dates'
import { minutesOn } from './store'
import { configured, supabase } from './supabase'
import type { AppState } from '../types'

/* 서버에는 숫자만 올린다. 글, 단어, 퀴즈 내용은 올라가지 않는다. */

const KEY = 'kitty-social-v1'
const LANGUAGE = 'ja'
const WINDOW_DAYS = 62

export type CheerKind = 'cheer' | 'nudge' | 'congrats'
export type GoalMetric = 'study_seconds' | 'articles_read' | 'words_reviewed'

export interface PartnerDay {
  seconds: number
  articles: number
  reviewed: number
  correct: number
  total: number
}

export interface Cheer {
  id: string
  kind: CheerKind
  created_at: string
  read_at: string | null
}

export interface Goal {
  id: string
  metric: GoalMetric
  target: number
  start_day: string
  end_day: string
  progress: number
}

interface Cache {
  userId: string | null
  email: string | null
  name: string
  friendshipId: string | null
  partnerId: string | null
  partnerName: string
  partnerDays: Record<string, PartnerDay>
  cheers: Cheer[]
  goals: Goal[]
  /** 아직 서버에 못 보낸 응원(오프라인에서 누른 것) */
  pending: CheerKind[]
  /** 날짜별로 마지막에 서버에 올린 숫자. 바뀐 날만 다시 올린다. */
  pushed: Record<string, string>
  lastSync: number | null
}

export interface SocialState extends Cache {
  ready: boolean
  status: 'idle' | 'syncing' | 'offline' | 'error'
  error: string
}

const emptyCache = (): Cache => ({
  userId: null,
  email: null,
  name: '',
  friendshipId: null,
  partnerId: null,
  partnerName: '',
  partnerDays: {},
  cheers: [],
  goals: [],
  pending: [],
  pushed: {},
  lastSync: null,
})

function loadCache(): Cache {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...emptyCache(), ...(JSON.parse(raw) as Partial<Cache>) } : emptyCache()
  } catch {
    return emptyCache()
  }
}

let state: SocialState = { ...loadCache(), ready: !configured, status: 'idle', error: '' }
const listeners = new Set<() => void>()

function set(patch: Partial<SocialState>) {
  state = { ...state, ...patch }
  try {
    const { ready: _r, status: _s, error: _e, ...cache } = state
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // 저장이 막혀도 앱은 계속 쓸 수 있다.
  }
  listeners.forEach((l) => l())
}

export function useSocial() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export const signedIn = (s: SocialState) => !!s.userId
export const connected = (s: SocialState) => !!s.partnerId
export const unreadCheers = (s: SocialState) => s.cheers.filter((c) => !c.read_at).length

/* ---------- 오류 문장 ---------- */

const isNetwork = (e: unknown) => /fetch|network|load failed|timeout/i.test(e instanceof Error ? e.message : String(e))

const MESSAGES: [RegExp, string][] = [
  [/too many cheers/i, '오늘은 응원을 너무 많이 보냈어요. 내일 또 보내요!'],
  [/invalid login credentials/i, '이메일이나 비밀번호가 맞지 않아요.'],
  [/already registered|already been registered/i, '이미 가입한 이메일이에요. 로그인해 주세요.'],
  [/password should be at least/i, '비밀번호는 6자 이상이어야 해요.'],
  [/email not confirmed/i, '이메일 확인이 켜져 있어요. Supabase 설정에서 Confirm email 을 꺼 주세요.'],
  [/valid email|invalid email/i, '이메일 주소를 확인해 주세요.'],
]

function explain(e: unknown) {
  if (isNetwork(e)) return '인터넷에 연결되면 다시 시도할게요.'
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return MESSAGES.find(([re]) => re.test(msg))?.[1] ?? msg
}

/* ---------- 로그인 ---------- */

export async function signUp(email: string, password: string, name: string) {
  if (!supabase) return
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(explain(error))
  if (!data.session) throw new Error('이메일 확인이 켜져 있어요. Supabase 설정에서 Confirm email 을 꺼 주세요.')
  adopt(data.session.user.id, email)
  if (name.trim()) await updateName(name).catch(() => {})
}

export async function signIn(email: string, password: string) {
  if (!supabase) return
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(explain(error))
  adopt(data.user.id, email)
}

export async function signOut() {
  await supabase?.auth.signOut().catch(() => {})
  set({ ...emptyCache(), ready: true, status: 'idle', error: '' })
}

/** 다른 계정으로 바뀌면 이전 계정의 캐시는 버린다. */
function adopt(userId: string, email: string | null) {
  if (state.userId !== userId) set({ ...emptyCache(), userId, email })
  else set({ email })
}

/* ---------- 동기화 ---------- */

const dayPayload = (s: AppState, day: string) => {
  const log = s.days[day]
  return {
    study_seconds: minutesOn(s, day) * 60,
    articles_read: log?.articles ?? 0,
    words_reviewed: log?.reviewed ?? 0,
    quiz_correct: Math.min(log?.quizCorrect ?? 0, log?.quizTotal ?? 0),
    quiz_total: log?.quizTotal ?? 0,
  }
}

async function pushDays(app: AppState) {
  if (!supabase || !state.userId) return
  const from = addDays(today(), -WINDOW_DAYS)
  const pushed = { ...state.pushed }
  for (const day of Object.keys(app.days)) {
    if (day < from) continue
    const nums = dayPayload(app, day)
    if (Object.values(nums).every((n) => n === 0)) continue
    const sig = JSON.stringify(nums)
    if (pushed[day] === sig) continue
    // 키 열(user_id, day, language)은 수정 권한이 없어서 upsert 대신 수정 → 없으면 추가 순서로 올린다.
    const upd = await supabase
      .from('daily_progress')
      .update(nums)
      .eq('user_id', state.userId)
      .eq('day', day)
      .eq('language', LANGUAGE)
      .select('day')
    if (upd.error) throw upd.error
    if (!upd.data.length) {
      const ins = await supabase.from('daily_progress').insert({ user_id: state.userId, day, language: LANGUAGE, ...nums })
      if (ins.error) throw ins.error
    }
    pushed[day] = sig
  }
  set({ pushed })
}

async function flushCheers() {
  if (!supabase || !state.userId || !state.partnerId) return
  while (state.pending.length) {
    const kind = state.pending[0]
    const { error } = await supabase.from('cheers').insert({ from_user: state.userId, to_user: state.partnerId, kind })
    if (error && !/too many cheers/i.test(error.message)) throw error
    set({ pending: state.pending.slice(1) })
  }
}

async function pull() {
  if (!supabase || !state.userId) return
  const me = state.userId
  const mine = await supabase.from('profiles').select('display_name').eq('id', me).maybeSingle()
  if (mine.error) throw mine.error
  let fr = await supabase.from('friendships').select('id, user_a, user_b').limit(1).maybeSingle()
  if (fr.error) throw fr.error
  if (!fr.data) {
    // 두 사람만 쓰는 앱이라 초대 코드 없이, 아직 짝이 없는 다른 사람과 자동으로 이어진다.
    const pair = await supabase.rpc('connect_partner')
    if (pair.error) throw pair.error
    if (pair.data) {
      fr = await supabase.from('friendships').select('id, user_a, user_b').limit(1).maybeSingle()
      if (fr.error) throw fr.error
    }
  }

  const patch: Partial<SocialState> = {
    name: mine.data?.display_name ?? '',
    friendshipId: fr.data?.id ?? null,
    partnerId: fr.data ? (fr.data.user_a === me ? fr.data.user_b : fr.data.user_a) : null,
  }
  if (!patch.partnerId) Object.assign(patch, { partnerName: '', partnerDays: {}, cheers: [], goals: [] })
  set(patch)
  if (!state.partnerId) return

  const pp = await supabase.from('profiles').select('display_name').eq('id', state.partnerId).maybeSingle()
  if (pp.error) throw pp.error
  const rows = await supabase
    .from('daily_progress')
    .select('day, study_seconds, articles_read, words_reviewed, quiz_correct, quiz_total')
    .eq('user_id', state.partnerId)
    .gte('day', addDays(today(), -WINDOW_DAYS))
  if (rows.error) throw rows.error
  const partnerDays: Record<string, PartnerDay> = {}
  for (const r of rows.data) {
    // 학습 언어가 둘 다 있는 날은 합친다.
    const d = (partnerDays[r.day] ??= { seconds: 0, articles: 0, reviewed: 0, correct: 0, total: 0 })
    d.seconds += r.study_seconds
    d.articles += r.articles_read
    d.reviewed += r.words_reviewed
    d.correct += r.quiz_correct
    d.total += r.quiz_total
  }

  const ch = await supabase
    .from('cheers')
    .select('id, kind, created_at, read_at')
    .eq('to_user', me)
    .order('created_at', { ascending: false })
    .limit(30)
  if (ch.error) throw ch.error

  const gl = await supabase.from('shared_goals').select('id, metric, target, start_day, end_day').order('created_at', { ascending: false })
  if (gl.error) throw gl.error
  const goals: Goal[] = []
  for (const g of gl.data) {
    const p = await supabase.rpc('goal_progress', { p_goal: g.id })
    if (p.error) throw p.error
    goals.push({ ...g, progress: Number(p.data ?? 0) })
  }

  set({ partnerName: pp.data?.display_name ?? '', partnerDays, cheers: ch.data as Cheer[], goals })
}

let running: Promise<void> | null = null
let queuedApp: AppState | null = null

/** 로컬 기록을 올리고 친구 기록을 받아 온다. 오프라인이면 조용히 넘어가고 다음에 다시 한다. */
export function sync(app: AppState): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (running) {
    queuedApp = app
    return running
  }
  running = (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) {
        set({ ready: true, status: 'idle', error: '' })
        return
      }
      adopt(user.id, user.email ?? null)
      set({ status: 'syncing', error: '' })
      await pushDays(app)
      await pull()
      await flushCheers()
      set({ ready: true, status: 'idle', lastSync: Date.now() })
    } catch (e) {
      set({ ready: true, status: isNetwork(e) ? 'offline' : 'error', error: isNetwork(e) ? '' : explain(e) })
    } finally {
      running = null
      if (queuedApp) {
        const next = queuedApp
        queuedApp = null
        void sync(next)
      }
    }
  })()
  return running
}

/* ---------- 행동 ---------- */

async function run<T>(fn: () => PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await fn()
  if (error) throw new Error(explain(error))
  return data
}

export async function updateName(name: string) {
  if (!supabase || !state.userId) return
  const next = name.trim().slice(0, 20)
  await run(() => supabase!.from('profiles').update({ display_name: next }).eq('id', state.userId!))
  set({ name: next })
}

/** 인터넷이 없어도 눌러 두면 연결될 때 보낸다. */
export function sendCheer(kind: CheerKind, app: AppState) {
  set({ pending: [...state.pending, kind] })
  void sync(app)
}

export async function markCheersRead() {
  if (!supabase || !state.userId || !unreadCheers(state)) return
  const now = new Date().toISOString()
  const { error } = await supabase.from('cheers').update({ read_at: now }).eq('to_user', state.userId).is('read_at', null)
  if (!error) set({ cheers: state.cheers.map((c) => (c.read_at ? c : { ...c, read_at: now })) })
}

export async function createGoal(metric: GoalMetric, target: number, days: number, app: AppState) {
  if (!supabase || !state.userId || !state.friendshipId) return
  await run(() =>
    supabase!.from('shared_goals').insert({
      friendship_id: state.friendshipId,
      metric,
      target,
      start_day: today(),
      end_day: addDays(today(), days - 1),
      created_by: state.userId,
    }),
  )
  await sync(app)
}

export async function deleteGoal(id: string) {
  if (!supabase) return
  await run(() => supabase!.from('shared_goals').delete().eq('id', id))
  set({ goals: state.goals.filter((g) => g.id !== id) })
}

/* ---------- 친구 기록 읽기 ---------- */

export const partnerRead = (s: SocialState, day: string) => (s.partnerDays[day]?.articles ?? 0) > 0

export function partnerStreak(s: SocialState) {
  let day = today()
  if (!partnerRead(s, day)) day = addDays(day, -1)
  let n = 0
  while (partnerRead(s, day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}
