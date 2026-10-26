export function Paw({ who, cls = '' }: { who: 'me' | 'fr'; cls?: string }) {
  return (
    <svg className={`paw ${who} ${cls}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 11.2c-3.1 0-5.7 3-5.7 5.5 0 2 1.6 2.8 3.1 2.8 1 0 1.6-.5 2.6-.5s1.6.5 2.6.5c1.5 0 3.1-.8 3.1-2.8 0-2.5-2.6-5.5-5.7-5.5z" />
      <ellipse cx="4.3" cy="11" rx="2" ry="2.7" transform="rotate(-18 4.3 11)" />
      <ellipse cx="8.8" cy="6.2" rx="2.1" ry="2.8" transform="rotate(-8 8.8 6.2)" />
      <ellipse cx="15.2" cy="6.2" rx="2.1" ry="2.8" transform="rotate(8 15.2 6.2)" />
      <ellipse cx="19.7" cy="11" rx="2" ry="2.7" transform="rotate(18 19.7 11)" />
    </svg>
  )
}
