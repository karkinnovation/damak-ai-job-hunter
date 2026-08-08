'use client'

import { useState } from 'react'

// Wraps the search submit button so people get instant feedback (spinner +
// disabled state) the moment they hit "Find jobs", instead of wondering
// whether the click registered while the page reloads with results.
export default function SearchSubmitButton({ className = 'button searchButton', label = 'Find jobs' }: { className?: string; label?: string }) {
  const [pending, setPending] = useState(false)

  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={() => setPending(true)}
    >
      {pending && <span className="spinner" aria-hidden="true" />}
      {pending ? 'Searching…' : label}
    </button>
  )
}
