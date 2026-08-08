import type { SVGProps } from 'react'

/*
 * Small inline SVG icon set.
 *
 * Deliberately dependency-free: no icon package to install, no extra JS
 * shipped to the browser, and every glyph inherits currentColor so it
 * picks up the surrounding text colour automatically.
 *
 * These replace the text characters the UI used before (⌕ ✓ ⚠ ✦), which
 * rendered inconsistently across Windows/Android and looked misaligned
 * next to real type.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconSearch = (p: IconProps) => (
  <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Base>
)

export const IconMapPin = (p: IconProps) => (
  <Base {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Base>
)

export const IconWallet = (p: IconProps) => (
  <Base {...p}><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M16 12h3" /></Base>
)

export const IconClock = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Base>
)

export const IconBriefcase = (p: IconProps) => (
  <Base {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></Base>
)

export const IconUsers = (p: IconProps) => (
  <Base {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 8.2a3.5 3.5 0 0 1 0 6.8" /><path d="M18.5 20a6.4 6.4 0 0 0-2-4.2" /></Base>
)

export const IconCheck = (p: IconProps) => (
  <Base {...p}><path d="m4.5 12.5 5 5 10-11" /></Base>
)

export const IconAlert = (p: IconProps) => (
  <Base {...p}><path d="M12 4.5 2.8 20h18.4Z" /><path d="M12 10v4" /><path d="M12 17.2v.1" /></Base>
)

export const IconSparkle = (p: IconProps) => (
  <Base {...p}><path d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9Z" /></Base>
)

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}><path d="M4.5 12h14" /><path d="m13 6.5 5.5 5.5-5.5 5.5" /></Base>
)

export const IconGraduation = (p: IconProps) => (
  <Base {...p}><path d="m12 4 9.5 4.8L12 13.6 2.5 8.8Z" /><path d="M6.5 11v4.6c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V11" /></Base>
)
