import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { Lang } from '../types'

/** 학습 언어 → 기기 음성 언어 */
export const VOICE_LANG: Record<Lang, string> = { ja: 'ja-JP', en: 'en-US' }

/** 지금 읽고 있는 것의 이름표(글 id, 단어 키 등). 아무것도 안 읽으면 null. */
let current: string | null = null
/** 읽기를 새로 시작하거나 멈출 때마다 올려서, 먼저 시작한 읽기가 뒤늦게 이어지지 않게 한다. */
let run = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const set = (k: string | null) => {
  current = k
  emit()
}

const native = Capacitor.isNativePlatform()

/** 지금 재생 중인 클라우드 음성. 멈출 때 끝내려고 들고 있다. */
let player: { audio: HTMLAudioElement; done: () => void } | null = null

const CACHE = 'kitty-tts-v1'
const MAX_PART = 1400

/** 너무 긴 조각은 문장 끝에서 잘라 서버 한도(1,500자) 안에 맞춘다. */
function chunk(text: string): string[] {
  if (text.length <= MAX_PART) return [text]
  const out: string[] = []
  let cur = ''
  for (const s of text.split(/(?<=[.!?。！？])\s*/)) {
    if (cur && cur.length + s.length > MAX_PART) {
      out.push(cur)
      cur = ''
    }
    cur += (cur ? ' ' : '') + s
  }
  if (cur) out.push(cur)
  return out.flatMap((c) => (c.length > MAX_PART ? c.match(new RegExp(`.{1,${MAX_PART}}`, 'gs')) ?? [] : [c]))
}

async function hash(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 서버(Edge Function tts)에서 받은 음성. 한 번 받은 소리는 기기에 저장해 두고 다시 쓴다. 안 되면 null. */
async function cloudAudio(text: string, lang: Lang, rate: number): Promise<Blob | null> {
  try {
    const cache = 'caches' in window ? await caches.open(CACHE) : null
    const req = new Request(`https://tts.local/${lang}/${rate}/${await hash(text)}`)
    const hit = await cache?.match(req)
    if (hit) return await hit.blob()
    if (!supabase || navigator.onLine === false) return null
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) return null
    const { data, error } = await supabase.functions.invoke<{ audio?: string }>('tts', { body: { text, lang, rate } })
    if (error || !data?.audio) return null
    const bin = atob(data.audio)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'audio/mpeg' })
    await cache?.put(req, new Response(blob)).catch(() => {})
    return blob
  } catch {
    return null
  }
}

function playBlob(blob: Blob) {
  return new Promise<void>((resolve, reject) => {
    const src = URL.createObjectURL(blob)
    const audio = new Audio(src)
    const done = () => {
      URL.revokeObjectURL(src)
      if (player?.audio === audio) player = null
      resolve()
    }
    player = { audio, done }
    audio.onended = done
    audio.onerror = () => {
      URL.revokeObjectURL(src)
      if (player?.audio === audio) player = null
      reject(new Error('audio'))
    }
    audio.play().catch(reject)
  })
}

/** 기기에 들어 있는 음성으로 읽는다. */
async function deviceSay(text: string, lang: Lang, rate: number) {
  if (native) {
    await TextToSpeech.speak({ text, lang: VOICE_LANG[lang], rate, pitch: 1, volume: 1, category: 'playback' })
    return
  }
  // 브라우저(개발용)에서는 웹 음성 합성으로 대신한다.
  const synth = window.speechSynthesis
  if (!synth) throw new Error('unsupported')
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = VOICE_LANG[lang]
    u.rate = rate
    u.onend = () => resolve()
    u.onerror = (e) => (e.error === 'canceled' || e.error === 'interrupted' ? resolve() : reject(e))
    synth.speak(u)
  })
}

/** 한 조각 읽기. 클라우드 음성이 되면 그걸로, 안 되면(오프라인·한도·미설정) 기기 음성으로 읽는다. */
async function say(text: string, lang: Lang, rate: number) {
  const blob = await cloudAudio(text, lang, rate)
  if (blob) {
    await playBlob(blob).catch(() => deviceSay(text, lang, rate))
    return
  }
  await deviceSay(text, lang, rate)
}

export async function stopSpeech() {
  run++
  if (current !== null) set(null)
  player?.audio.pause()
  player?.done()
  try {
    if (native) await TextToSpeech.stop()
    else window.speechSynthesis?.cancel()
  } catch {
    /* 이미 멈춰 있다 */
  }
}

/**
 * 글 조각들을 차례로 읽는다. 같은 이름표로 다시 부르면 멈춘다.
 * 읽을 수 없으면 false를 돌려준다(음성이 없는 기기 등).
 */
export async function speak(key: string, parts: string[], lang: Lang, rate = 0.9): Promise<boolean> {
  if (current === key) {
    await stopSpeech()
    return true
  }
  await stopSpeech()
  const mine = ++run
  const texts = parts.flatMap((t) => chunk(t.trim())).filter(Boolean)
  if (!texts.length) return false
  set(key)
  try {
    for (const t of texts) {
      if (mine !== run) return true
      await say(t, lang, rate)
    }
  } catch {
    if (mine === run) set(null)
    return false
  }
  if (mine === run) set(null)
  return true
}

export function useSpeaking() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    () => current,
  )
}
