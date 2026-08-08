'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  jobId: string
  candidateId?: string
  fallback: string
  auto?: boolean
}

type CachedExplanation = { text: string; savedAt: number }
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

export function AIExplanation({ jobId, candidateId, fallback, auto = false }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const startedRef = useRef(false)
  const [text, setText] = useState(fallback)
  const [status, setStatus] = useState<'idle'|'loading'|'ready'>('idle')
  const cacheKey = `awasar-ai:${jobId}:${candidateId || 'self'}`

  const readCache = useCallback(() => {
    try {
      const raw = window.sessionStorage.getItem(cacheKey)
      if (!raw) return null
      const cached = JSON.parse(raw) as CachedExplanation
      if (!cached.text || Date.now() - cached.savedAt > CACHE_TTL_MS) {
        window.sessionStorage.removeItem(cacheKey)
        return null
      }
      return cached.text
    } catch {
      return null
    }
  }, [cacheKey])

  const generate = useCallback(async () => {
    if (startedRef.current) return

    const cached = readCache()
    if (cached) {
      startedRef.current = true
      setText(cached)
      setStatus('ready')
      return
    }

    startedRef.current = true
    setStatus('loading')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, candidateId }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('AI explanation unavailable')
      const data = await response.json() as { explanation?: string }
      if (data.explanation) {
        setText(data.explanation)
        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify({ text: data.explanation, savedAt: Date.now() }))
        } catch {}
      }
    } catch {
      // The deterministic explanation remains visible if Gemini is unavailable or slow.
    } finally {
      window.clearTimeout(timer)
      setStatus('ready')
    }
  }, [cacheKey, candidateId, jobId, readCache])

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      startedRef.current = true
      setText(cached)
      setStatus('ready')
      return
    }

    if (!auto || !rootRef.current) return
    if (!('IntersectionObserver' in window)) {
      void generate()
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        window.setTimeout(() => void generate(), 120)
      }
    }, { rootMargin: '120px' })

    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [auto, generate, readCache])

  return (
    <div className="aiExplanation" ref={rootRef}>
      <div className="aiExplanationHead">
        <span className="aiBadge">✦ AI explanation</span>
        {status === 'loading' && <span className="aiStatus">Generating…</span>}
        {status === 'idle' && !auto && (
          <button type="button" className="aiAction" onClick={() => void generate()}>
            Explain match
          </button>
        )}
      </div>
      <p>{text}</p>
    </div>
  )
}
