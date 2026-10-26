import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Lang } from '../types'

export interface AskContext {
  lang: Lang
  title: string
  selection: string
  selectionReading?: string
  paragraph: string
  paragraphReading?: string
}

export interface AskMessage {
  role: 'user' | 'assistant'
  content: string
}

export type AskResult =
  | { ok: true; answer: string; remaining: number }
  | { ok: false; reason: 'offline' | 'login' | 'unavailable' | 'limit' | 'fast' | 'busy'; message: string }

const fail = (reason: Extract<AskResult, { ok: false }>['reason'], message: string): AskResult => ({ ok: false, reason, message })

/** 서버 함수(ask)에 물어본다. Anthropic 키는 서버에만 있고, 앱은 로그인한 사용자의 토큰만 보낸다. 실패해도 앱은 멈추지 않는다. */
export async function askClaude(ctx: AskContext, messages: AskMessage[]): Promise<AskResult> {
  if (!supabase) return fail('unavailable', '지금은 물어볼 수 없어요. 서버 연결이 아직 준비되지 않았어요.')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return fail('offline', '지금은 물어볼 수 없어요. 인터넷에 연결되면 다시 눌러 주세요.')
  try {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) return fail('login', '로그인하면 물어볼 수 있어요. 함께 탭에서 로그인해 주세요.')
    const { data, error } = await supabase.functions.invoke<{ answer?: string; remaining?: number }>('ask', { body: { ...ctx, messages } })
    if (error) throw error
    if (!data?.answer) return fail('unavailable', '지금은 물어볼 수 없어요. 잠시 뒤에 다시 해 주세요.')
    return { ok: true, answer: data.answer, remaining: data.remaining ?? 0 }
  } catch (e) {
    if (e instanceof FunctionsFetchError) return fail('offline', '지금은 물어볼 수 없어요. 인터넷에 연결되면 다시 눌러 주세요.')
    if (e instanceof FunctionsRelayError) return fail('unavailable', '지금은 물어볼 수 없어요. 질문 기능이 아직 켜지지 않았어요.')
    if (e instanceof FunctionsHttpError) {
      const status = e.context instanceof Response ? e.context.status : 0
      const code = await (e.context as Response).json().then((b: { error?: string }) => b.error ?? '', () => '')
      if (status === 404) return fail('unavailable', '지금은 물어볼 수 없어요. 질문 기능이 아직 켜지지 않았어요.')
      if (code === 'login_required' || status === 401) return fail('login', '로그인이 필요해요. 함께 탭에서 다시 로그인해 주세요.')
      if (code === 'daily_limit') return fail('limit', '오늘은 질문을 다 썼어요. 내일 또 물어봐요!')
      if (code === 'too_fast') return fail('fast', '조금만 천천히요. 잠깐 뒤에 다시 눌러 주세요.')
      if (code === 'not_configured') return fail('unavailable', '지금은 물어볼 수 없어요. 질문 기능이 아직 켜지지 않았어요.')
      if (code === 'busy') return fail('busy', '지금 질문이 몰려 있어요. 잠시 뒤에 다시 해 주세요.')
    }
    return fail('unavailable', '지금은 물어볼 수 없어요. 잠시 뒤에 다시 해 주세요.')
  }
}
