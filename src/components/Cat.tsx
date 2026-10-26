export type Pose = 'sit' | 'happy' | 'eat' | 'sleep' | 'loaf'

/** 확정한 삼색 고양이. 움직이는 WebP를 그대로 보여 준다. */
export function Cat({ pose, scale = 1, className = '' }: { pose: Pose; scale?: number; className?: string }) {
  return (
    <img
      className={`cat ${className}`}
      src={`${import.meta.env.BASE_URL}cat/${pose}.webp`}
      style={{ height: 120 * scale }}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}
