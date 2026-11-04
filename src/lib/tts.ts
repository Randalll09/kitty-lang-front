import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { useSyncExternalStore } from 'react'
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

async function say(text: string, lang: Lang, rate: number) {
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

export async function stopSpeech() {
  run++
  if (current !== null) set(null)
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
  const texts = parts.map((t) => t.trim()).filter(Boolean)
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
