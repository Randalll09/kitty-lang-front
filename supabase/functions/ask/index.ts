// 읽기 화면의 "밑줄 질문". 앱 대신 서버가 Claude 를 호출한다.
// Anthropic API 키는 Supabase secrets(ANTHROPIC_API_KEY)에만 두고 앱과 저장소에는 넣지 않는다.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

// 빠르고 가장 싼 최신 모델(입력 $0.10, 출력 $0.50 / 100만 토큰). 짧은 문장 설명에는 이 정도면 충분하다.
const MODEL = Deno.env.get('ASK_MODEL') ?? 'claude-haiku-5-5'
const DAILY_LIMIT = Number(Deno.env.get('ASK_DAILY_LIMIT') ?? 40)
const MIN_GAP_SECONDS = 2
const MAX_TOKENS = 700

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Msg = { role: 'user' | 'assistant'; content: string }
interface Body {
  lang: 'ja' | 'en'
  title: string
  selection: string
  selectionReading?: string
  paragraph: string
  paragraphReading?: string
  messages: Msg[]
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null)

/** 요청 본문을 검사한다. 길이를 제한해 비용이 한없이 커지지 않게 한다. */
function parse(raw: unknown): Body | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  if (b.lang !== 'ja' && b.lang !== 'en') return null
  const title = str(b.title, 120)
  const selection = str(b.selection, 400)
  const paragraph = str(b.paragraph, 1200)
  const selectionReading = b.selectionReading === undefined ? '' : str(b.selectionReading, 800)
  const paragraphReading = b.paragraphReading === undefined ? '' : str(b.paragraphReading, 2400)
  if (title === null || !selection?.trim() || paragraph === null || selectionReading === null || paragraphReading === null) return null
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > 12) return null
  const messages: Msg[] = []
  for (const m of b.messages) {
    const role = (m as Msg)?.role
    const content = str((m as Msg)?.content, 3000)
    if ((role !== 'user' && role !== 'assistant') || !content?.trim()) return null
    messages.push({ role, content })
  }
  if (messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') return null
  return { lang: b.lang, title, selection, selectionReading, paragraph, paragraphReading, messages }
}

function systemPrompt(b: Body) {
  const common = [
    '너는 언어 학습 앱 속 삼색 고양이 선생님이야. 한국인 초보 학습자가 글을 읽다가 밑줄을 긋고 물어본 부분에 답해 줘.',
    '항상 한국어로, 친근하고 짧게 답해. 보통 3~6문장, 길어도 10문장을 넘기지 마. 마크다운 제목이나 표는 쓰지 말고, 필요하면 짧은 목록만 써.',
    '먼저 질문에 바로 답하고, 그다음 필요할 때만 예문을 1~2개 보여 줘. 어려운 문법 용어는 되도록 피하고 쓰면 쉬운 말로 풀어 줘.',
    '글에 없는 내용을 지어내지 말고, 확실하지 않으면 그렇다고 말해. 학습과 관계없는 요청에는 정중하게 글 이야기로 돌려 줘.',
  ]
  const ja = [
    '학습자는 일본어 입문자이고 히라가나만 읽을 수 있어. 한자는 읽지 못해.',
    '일본어를 쓸 때는 한자 없이 히라가나(와 필요한 가타카나)로만 써. 아래 "읽는 법"에 적힌 히라가나를 그대로 가져다 써도 돼. 로마자는 쓰지 마.',
    '단어나 문장은 일본어 뒤에 한국어 뜻을 붙여 줘.',
  ]
  const en = [
    '학습자는 영어 입문~초급자야. 영어 예문은 쉽고 짧은 단어로 쓰고, 예문마다 한국어 뜻을 붙여 줘.',
  ]
  const ctx = [
    `글 제목: ${b.title}`,
    `밑줄 친 부분: ${b.selection}`,
    ...(b.selectionReading ? [`밑줄 친 부분의 읽는 법: ${b.selectionReading}`] : []),
    `밑줄이 있는 문단: ${b.paragraph}`,
    ...(b.paragraphReading ? [`문단 읽는 법: ${b.paragraphReading}`] : []),
  ]
  return [...common, ...(b.lang === 'ja' ? ja : en), '', '<context>', ...ctx, '</context>'].join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply(405, { error: 'method' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!url || !serviceKey) return reply(500, { error: 'server' })
  if (!apiKey) return reply(503, { error: 'not_configured' })

  // 로그인한 사용자만. anon key 는 사용자 토큰이 아니라서 getUser 에서 걸러진다.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: null, error: true }
  const user = auth && 'user' in auth ? auth.user : null
  if (authError || !user) return reply(401, { error: 'login_required' })

  const text = await req.text()
  if (text.length > 40_000) return reply(413, { error: 'too_long' })
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  const body = parse(raw)
  if (!body) return reply(400, { error: 'bad_request' })

  // 하루 한도와 연속 호출 간격. 한도를 넘으면 Claude 는 부르지 않는다.
  const { data: used, error: quotaError } = await admin.rpc('take_ask_quota', {
    p_user: user.id,
    p_limit: DAILY_LIMIT,
    p_gap_seconds: MIN_GAP_SECONDS,
  })
  if (quotaError || typeof used !== 'number') return reply(500, { error: 'server' })
  if (used === -1) return reply(429, { error: 'daily_limit', limit: DAILY_LIMIT })
  if (used === -2) return reply(429, { error: 'too_fast' })

  try {
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      system: systemPrompt(body),
      messages: body.messages,
    })
    if (res.stop_reason === 'refusal') return reply(200, { answer: '이 질문에는 답하기 어려워요. 글에 나온 표현으로 다시 물어봐 줄래요?', remaining: DAILY_LIMIT - used })
    const answer = res.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('\n').trim()
    if (!answer) return reply(502, { error: 'upstream' })
    return reply(200, { answer, remaining: DAILY_LIMIT - used })
  } catch (e) {
    console.error('anthropic error', e instanceof Error ? e.message : e)
    const status = e instanceof Anthropic.APIError ? e.status : 0
    return reply(status === 429 || status === 529 ? 503 : 502, { error: status === 429 || status === 529 ? 'busy' : 'upstream' })
  }
})
