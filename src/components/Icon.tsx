const PATHS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  list: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  quiz: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" />
      <path d="M12 17h.01" />
    </>
  ),
  cards: (
    <>
      <rect x="3.5" y="8" width="12" height="12" rx="2" />
      <path d="M8 5h11a1.5 1.5 0 0 1 1.5 1.5V16" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  paw: (
    <>
      <path d="M12 11.2c-3.1 0-5.7 3-5.7 5.5 0 2 1.6 2.8 3.1 2.8 1 0 1.6-.5 2.6-.5s1.6.5 2.6.5c1.5 0 3.1-.8 3.1-2.8 0-2.5-2.6-5.5-5.7-5.5z" />
      <ellipse cx="4.3" cy="11" rx="2" ry="2.7" transform="rotate(-18 4.3 11)" />
      <ellipse cx="8.8" cy="6.2" rx="2.1" ry="2.8" transform="rotate(-8 8.8 6.2)" />
      <ellipse cx="15.2" cy="6.2" rx="2.1" ry="2.8" transform="rotate(8 15.2 6.2)" />
      <ellipse cx="19.7" cy="11" rx="2" ry="2.7" transform="rotate(18 19.7 11)" />
    </>
  ),
  mark: <path d="M7 4h10v16l-5-4-5 4z" />,
  pen: (
    <>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
}

export function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
