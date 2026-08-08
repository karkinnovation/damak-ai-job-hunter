'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  jobId: string
  candidateId?: string
  fallback: string
  auto?: boolean
}

export function AIExplanation({ jobId, candidateId, fallback, auto = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const [text, setText] = useState(fallback)
  const [status, setStatus] = useState<'idle'|'loading'|'ready'>('idle')

  const generate = useCallback(async () => {
    if (startedRef.current) return
    startedRef.current = true
    setStatus('loading')

    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, candidateId }),
      })
      if (!response.ok) throw new Error('AI explanation unavailable')
      const data = await response.json() as { explanation?: string }
      if (data.explanation) setText(data.explanation)
    } catch {
      // The deterministic explanation remains visible if Gemini is unavailable.
    } finally {
      setStatus('ready')
    }
  }, [jobId, candidateId])

  useEffect(() => {
    if (!auto || !rootRef.current) return
    if (!('IntersectionObserver' in window)) {
      void generate()
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        void generate()
      }
    }, { rootMargin: '180px' })

    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [auto, generate])

  return (
    <div className="aiExplanation" ref={rootRef}>
      <div className="aiExplanationHead">
        <span className="aiBadge">✦AI Overview</span>
        {status === 'loading' && <span className="aiStatus">Generating explanation…</span>}
        {status === 'idle' && !auto && <button type="button" className="aiAction" onClick={() => void generate()}>Ask AI</button>}
      </div>
      <p>{text}</p>
    </div>
  )
}
