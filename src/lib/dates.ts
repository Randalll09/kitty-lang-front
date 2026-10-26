const pad = (n: number) => String(n).padStart(2, '0')

export const dayString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => dayString(new Date())

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number)
  return dayString(new Date(y, m - 1, d + n))
}
