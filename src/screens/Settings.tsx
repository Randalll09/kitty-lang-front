import { FONT_SIZES, resetAll, update } from '../lib/store'
import type { AppState, Theme } from '../types'

const THEMES: [Theme, string][] = [['system', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']]

export function Settings({ state }: { state: AppState }) {
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
        <p className="soft small">친구와 숫자 기록을 나누는 기능은 서버를 연결하는 다음 단계에서 열려요. 지금은 모든 기록이 이 폰 안에만 저장돼요.</p>
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
