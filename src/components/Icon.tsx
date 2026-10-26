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
  mark: <path d="M7 4h10v16l-5-4-5 4z" />,
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
