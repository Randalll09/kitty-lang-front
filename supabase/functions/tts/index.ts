// 읽어주기용 클라우드 음성. 앱 대신 서버가 Google Cloud Text-to-Speech 를 호출한다.
// Google API 키는 Supabase secrets(GOOGLE_TTS_API_KEY)에만 두고 앱과 저장소에는 넣지 않는다.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

// Neural2: 월 100만 자까지 무료. 두 사람이 나눠 쓰도록 한 사람당 하루 글자 수를 제한한다(15,000자 × 2명 × 30일 = 90만 자).
const DAILY_CHARS = Number(Deno.env.get('TTS_DAILY_CHARS') ?? 15000)
const MAX_CHARS = 1500
const VOICES = {
  ja: { languageCode: 'ja-JP', name: Deno.env.get('TTS_VOICE_JA') ?? 'ja-JP-Neural2-B' },
  en: { languageCode: 'en-US', name: Deno.env.get('TTS_VOICE_EN') ?? 'en-US-Neural2-F' },
} as const

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply(405, { error: 'method' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiKey = Deno.env.get('GOOGLE_TTS_API_KEY')
  if (!url || !serviceKey) return reply(500, { error: 'server' })
  if (!apiKey) return reply(503, { error: 'not_configured' })

  // 로그인한 사용자만. anon key 는 사용자 토큰이 아니라서 getUser 에서 걸러진다.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: null, error: true }
  const user = auth && 'user' in auth ? auth.user : null
  if (authError || !user) return reply(401, { error: 'login_required' })

  const text = await req.text()
  if (text.length > 10_000) return reply(413, { error: 'too_long' })
  let b: { text?: unknown; lang?: unknown; rate?: unknown }
  try {
    b = JSON.parse(text)
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  if ((b.lang !== 'ja' && b.lang !== 'en') || typeof b.text !== 'string') return reply(400, { error: 'bad_request' })
  const input = b.text.trim()
  if (!input || input.length > MAX_CHARS) return reply(400, { error: 'bad_request' })
  const rate = typeof b.rate === 'number' && b.rate >= 0.5 && b.rate <= 1.5 ? b.rate : 0.9

  const { data: used, error: quotaError } = await admin.rpc('take_tts_quota', {
    p_user: user.id,
    p_chars: [...input].length,
    p_limit: DAILY_CHARS,
  })
  if (quotaError || typeof used !== 'number') return reply(500, { error: 'server' })
  if (used === -1) return reply(429, { error: 'daily_limit', limit: DAILY_CHARS })

  try {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify({
        input: { text: input },
        voice: VOICES[b.lang],
        audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
      }),
    })
    if (!res.ok) {
      console.error('google tts error', res.status)
      return reply(res.status === 429 ? 503 : 502, { error: res.status === 429 ? 'busy' : 'upstream' })
    }
    const { audioContent } = (await res.json()) as { audioContent?: string }
    if (!audioContent) return reply(502, { error: 'upstream' })
    return reply(200, { audio: audioContent, remaining: DAILY_CHARS - used })
  } catch (e) {
    console.error('google tts error', e instanceof Error ? e.message : e)
    return reply(502, { error: 'upstream' })
  }
})
