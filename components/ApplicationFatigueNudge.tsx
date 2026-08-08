'use client'

import { useState } from 'react'

export function ApplicationFatigueNudge({
  patternKey,
  title,
  message,
  actionLabel,
  actionHref,
}: {
  patternKey: string
  title: string
  message: string
  actionLabel: string
  actionHref: string
}) {
  const [visible, setVisible] = useState(true)
  const [busy, setBusy] = useState(false)

  if (!visible) return null

  async function dismiss() {
    setBusy(true)
    try {
      const res = await fetch('/api/seeker/nudges/dismiss', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patternKey }),
      })
      if (res.ok) setVisible(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card fatigueNudge" role="status">
      <div>
        <span className="eyebrow">Awasar insight</span>
        <h3>{title}</h3>
        <p className="muted">{message}</p>
        <a className="button secondary small" href={actionHref}>{actionLabel}</a>
      </div>
      <button className="nudgeDismiss" type="button" onClick={dismiss} disabled={busy} aria-label="Dismiss this insight">
        {busy ? '…' : '×'}
      </button>
    </div>
  )
}
