/*
 * A monogram tile standing in for an employer logo.
 *
 * Many local employers won't upload a logo, so instead of an
 * empty grey square (or nothing at all) every listing gets a consistent,
 * recognisable mark. The tint is derived from the business name, so the
 * same employer always looks the same across the site and the eye can
 * track a company down a list without reading it.
 */

const TINTS = [
  { bg: '#EBEDFA', fg: '#22297A' }, // indigo
  { bg: '#FCF0DC', fg: '#96610F' }, // marigold
  { bg: '#E3F2EC', fg: '#0E5C3C' }, // green
  { bg: '#FAE9E6', fg: '#8E2F23' }, // clay
  { bg: '#E7EEF7', fg: '#1F4A73' }, // slate blue
  { bg: '#F0EAF7', fg: '#4C2C77' }, // plum
]

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function CompanyMark({ name, size = 44 }: { name?: string | null; size?: number }) {
  const label = (name || 'Local employer').trim()

  // Simple deterministic hash so a business keeps its colour everywhere.
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  const tint = TINTS[hash % TINTS.length]

  return (
    <span
      className="companyMark"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: tint.bg,
        color: tint.fg,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(label)}
    </span>
  )
}
