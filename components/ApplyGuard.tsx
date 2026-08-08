'use client'

import { useRef, useState } from 'react'

export function ApplyGuard({
  action,
  jobId,
  matchScore,
  dailyRemaining,
  hourlyRemaining,
  blockedMessage,
}: {
  action: (formData: FormData) => void | Promise<void>
  jobId: string
  matchScore: number
  dailyRemaining: number
  hourlyRemaining: number
  blockedMessage?: string | null
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const lowMatch = matchScore < 40
  const blocked = Boolean(blockedMessage) || dailyRemaining <= 0 || hourlyRemaining <= 0

  function beginApply() {
    if (blocked) return
    if (lowMatch) setShowConfirm(true)
    else formRef.current?.requestSubmit()
  }

  return (
    <>
      <div className="card applicationLimitCard">
        <div>
          <span className="muted">Applications remaining</span>
          <strong>{dailyRemaining} today · {hourlyRemaining} this hour</strong>
        </div>
        {blockedMessage && <p className="notice">{blockedMessage}</p>}
        {lowMatch && !blocked && (
          <p className="lowMatchNotice"><strong>{matchScore}% match.</strong> This is a low compatibility match. You can still apply, but some requirements do not align with your profile.</p>
        )}
      </div>

      <form ref={formRef} action={action}>
        <input type="hidden" name="job_id" value={jobId} />
        <button className="button" type="button" onClick={beginApply} disabled={blocked}>
          {blocked ? 'Application limit reached' : lowMatch ? 'Review & apply' : 'Confirm application'}
        </button>
      </form>

      {showConfirm && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setShowConfirm(false)}>
          <div className="card lowMatchModal" role="dialog" aria-modal="true" aria-labelledby="low-match-title" onMouseDown={e => e.stopPropagation()}>
            <span className="eyebrow">Low match confirmation</span>
            <h2 id="low-match-title">This vacancy is a {matchScore}% match</h2>
            <p className="muted">You can still apply. Awasar is only asking you to confirm because your current profile has several mismatches with this role.</p>
            <div className="applyConfirmActions">
              <button className="button" type="button" onClick={() => { setShowConfirm(false); formRef.current?.requestSubmit() }}>Apply anyway</button>
              <button className="button secondary" type="button" onClick={() => setShowConfirm(false)}>Go back</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
