'use client'

import { KeyboardEvent, useEffect, useRef, useState } from 'react'

export type PlaceResult = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  source?: 'awasar' | 'osm'
  city?: string
  district?: string
  province?: string
  ward?: number
}

type CachedSearch = {
  savedAt: number
  results: PlaceResult[]
}

const CACHE_TTL = 24 * 60 * 60 * 1000

/*
 * IMPORTANT:
 * This component can live inside the seeker/employer profile <form>.
 * Do NOT render another <form> here. Nested forms are invalid HTML and can
 * cause the outer profile form to submit when the map Search button is clicked.
 *
 * The map search button is therefore type="button", and Enter is intercepted
 * explicitly so it runs geocoding without refreshing/submitting the page.
 */
export function PlaceSearch({
  onPick,
  placeholder = 'Search business, landmark or address',
}: {
  onPick: (place: PlaceResult) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const boxRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  function cacheKey(value: string) {
    return `awasar-place:${value.trim().toLowerCase()}`
  }

  function readCache(value: string) {
    try {
      const raw = sessionStorage.getItem(cacheKey(value))
      if (!raw) return null

      const cached = JSON.parse(raw) as CachedSearch

      if (!cached.savedAt || Date.now() - cached.savedAt > CACHE_TTL) {
        sessionStorage.removeItem(cacheKey(value))
        return null
      }

      return cached.results || []
    } catch {
      return null
    }
  }

  function writeCache(value: string, next: PlaceResult[]) {
    try {
      sessionStorage.setItem(
        cacheKey(value),
        JSON.stringify({
          savedAt: Date.now(),
          results: next,
        } satisfies CachedSearch)
      )
    } catch {
      // Search still works if browser storage is unavailable.
    }
  }

  async function search() {
    if (busy) return

    const q = query.trim()

    if (q.length < 2) {
      setResults([])
      setOpen(false)
      setStatus(
        'Type at least 2 characters, for example “Kathmandu”, “Pokhara Lakeside” or a business name.'
      )
      return
    }

    const cached = readCache(q)

    if (cached?.length) {
      setResults(cached)
      setOpen(true)
      setStatus(null)
      return
    }

    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    setBusy(true)
    setStatus('Searching places…')
    setOpen(false)

    // Avoid a request hanging indefinitely on slow external geocoding.
    const timeout = window.setTimeout(() => controller.abort(), 9000)

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })

      const data = await res.json().catch(() => ({ results: [] }))
      const next = (data.results || []) as PlaceResult[]

      if (!res.ok) {
        setResults([])
        setOpen(false)
        setStatus(
          data?.error ||
            'Place search is temporarily unavailable. You can still tap the map.'
        )
        return
      }

      if (!next.length) {
        setResults([])
        setOpen(false)
        setStatus(
          `Nothing found for “${q}”. Try the business name plus a city/district, a landmark, or tap the map.`
        )
        return
      }

      setResults(next)
      setOpen(true)
      setStatus(null)
      writeCache(q, next)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setResults([])
        setOpen(false)
        setStatus(
          'Place search took too long. Try a more specific place name, or tap the map directly.'
        )
      } else {
        setResults([])
        setOpen(false)
        setStatus(
          'Could not reach place search. You can still drop the pin directly on the map.'
        )
      }
    } finally {
      window.clearTimeout(timeout)
      setBusy(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return

    // Critical: stop the surrounding seeker/employer profile form submitting.
    e.preventDefault()
    e.stopPropagation()

    void search()
  }

  function pick(place: PlaceResult) {
    setQuery(place.name)
    setResults([])
    setOpen(false)
    setStatus(null)
    onPick(place)
  }

  return (
    <div
      className="placeSearch"
      ref={boxRef}
      onClick={e => e.stopPropagation()}
    >
      <div className="placeSearchField" role="search">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search for an address, landmark or business"
          aria-busy={busy}
          autoComplete="off"
        />

        <button
          type="button"
          className="placeSearchButton"
          disabled={busy}
          onClick={e => {
            // Critical: this button must never submit an outer profile form.
            e.preventDefault()
            e.stopPropagation()
            void search()
          }}
        >
          {busy ? (
            <>
              <span className="placeSearchSpinner" aria-hidden="true" />
              <span className="srOnly">Searching</span>
            </>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {open && results.length > 0 && (
        <ul className="placeResults">
          {results.map(place => (
            <li key={place.id}>
              <button
                type="button"
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  pick(place)
                }}
              >
                <span className="placeResultTitle">
                  <strong>{place.name}</strong>
                  {place.source === 'awasar' && <em>On Awasar</em>}
                </span>

                {place.address && <span>{place.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {status && (
        <p className="placeSearchStatus muted" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  )
}
