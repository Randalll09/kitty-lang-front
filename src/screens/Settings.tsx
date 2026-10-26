import { FONT_SIZES, resetAll, update } from '../lib/store'
import type { Screen } from '../App'
import type { AppState, Theme } from '../types'

const THEMES: [Theme, string][] = [['system', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']]

export function Settings({ state, go }: { state: AppState; go: (s: Screen) => void }) {
  const { settings } = state
  const set = (patch: Partial<typeof settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

  return (
    <div className="body">
      <div className="top"><h2 style={{ fontSize: 22 }}>설정</h2></div>

      <div className="card set">
        <h2>학습 언어</h2>
        <div className="seg" role="group" aria-label="학습 언어">
          <button type="button" aria-pressed="true">일본어</button>
          <button type="button" aria-pressed="false" disabled>영어 (준비 중)</button>
        </div>
      </div>

      <div className="card set">
        <h2>읽기</h2>
        <div className="row">
          <span>후리가나 기본 보기</span>
          <button className="sw" type="button" aria-pressed={settings.furigana} onClick={() => set({ furigana: !settings.furigana })}>
            <span className="knob" />{settings.furigana ? '켜짐' : '꺼짐'}
          </button>
        </div>
        <div className="row">
          <span>글씨 크기</span>
          <div className="sz">
            <button type="button" aria-label="글씨 작게" disabled={settings.fontIndex === 0} onClick={() => set({ fontIndex: settings.fontIndex - 1 })}>가</button>
            <span>{FONT_SIZES[settings.fontIndex]}</span>
            <button type="button" aria-label="글씨 크게" disabled={settings.fontIndex === FONT_SIZES.length - 1} onClick={() => set({ fontIndex: settings.fontIndex + 1 })} style={{ fontSize: 17 }}>가</button>
          </div>
        </div>
      </div>

      <div className="card set">
        <h2>화면</h2>
        <div className="seg" role="group" aria-label="화면 모드">
          {THEMES.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={settings.theme === v} onClick={() => set({ theme: v })}>{label}</button>
          ))}
        </div>
      </div>

      <div className="card set">
        <h2>친구와 같이 하기</h2>
        <p className="soft small">로그인과 친구 연결, 응원, 공동 목표는 ‘같이’ 탭에 있어요. 기록은 이 폰에 먼저 저장되고, 인터넷이 되면 숫자만 서버와 맞춰요.</p>
        <button className="btn ghost block" type="button" onClick={() => go({ name: 'together' })}>같이 탭 열기</button>
      </div>

      <div className="card set">
        <h2>데이터</h2>
        <button
          className="btn ghost block"
          type="button"
          onClick={() => {
            if (confirm('저장한 단어와 학습 기록이 모두 지워져요. 계속할까요?')) resetAll()
          }}
        >
          기록 모두 지우기
        </button>
      </div>
    </div>
  )
}
