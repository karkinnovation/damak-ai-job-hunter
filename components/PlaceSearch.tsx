'use client'

import { useEffect, useRef, useState } from 'react'

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
const DEBOUNCE_MS = 450
const MIN_QUERY_LENGTH = 3

export function PlaceSearch({
  onPick,
  placeholder = 'Start typing a business, landmark or place…',
}: {
  onPick: (place: PlaceResult) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)

  function key(value: string) {
    return `awasar-live-place:${value.trim().toLowerCase()}`
  }

  function readCache(value: string): PlaceResult[] | null {
    try {
      const raw = sessionStorage.getItem(key(value))
      if (!raw) return null

      const cached = JSON.parse(raw) as CachedSearch
      if (
        !cached.savedAt ||
        Date.now() - cached.savedAt > CACHE_TTL
      ) {
        sessionStorage.removeItem(key(value))
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
        key(value),
        JSON.stringify({
          savedAt: Date.now(),
          results: next,
        } satisfies CachedSearch)
      )
    } catch {
      // Search still works if storage is unavailable.
    }
  }

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', outside)

    return () => {
      document.removeEventListener('mousedown', outside)

      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }

      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    abortRef.current?.abort()

    const q = query.trim()

    if (!q) {
      setBusy(false)
      setResults([])
      setOpen(false)
      setMessage(null)
      return
    }

    if (q.length < MIN_QUERY_LENGTH) {
      setBusy(false)
      setResults([])
      setOpen(false)
      setMessage(`Type ${MIN_QUERY_LENGTH} or more characters`)
      return
    }

    const cached = readCache(q)
    if (cached) {
      setResults(cached)
      setOpen(cached.length > 0)
      setBusy(false)
      setMessage(cached.length ? null : 'No matching places yet.')
      return
    }

    setBusy(true)
    setMessage(null)

    const currentRequest = ++requestIdRef.current

    debounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error('Place search unavailable')
        }

        const data = (await response.json()) as {
          results?: PlaceResult[]
        }

        // Ignore stale responses from an older typed query.
        if (currentRequest !== requestIdRef.current) return

        const next = data.results || []

        setResults(next)
        setOpen(next.length > 0)
        setMessage(
          next.length
            ? null
            : 'No matching place found. Keep typing or tap the map directly.'
        )

        writeCache(q, next)
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
        if (currentRequest !== requestIdRef.current) return

        setResults([])
        setOpen(false)
        setMessage('Live places are unavailable right now. You can still tap the map.')
      } finally {
        if (currentRequest === requestIdRef.current) {
          setBusy(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  function pick(place: PlaceResult) {
    requestIdRef.current += 1
    abortRef.current?.abort()

    setQuery(place.name)
    setResults([])
    setOpen(false)
    setBusy(false)
    setMessage(null)

    onPick(place)
  }

  return (
    <div className="placeSearch livePlaceSearch" ref={rootRef}>
      <div className="placeSearchField">
        <span className="livePlaceSearchIcon" aria-hidden="true">
          ⌖
        </span>

        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          onFocus={() => {
            if (results.length) setOpen(true)
          }}
          onKeyDown={event => {
            // This component sits inside profile forms.
            // Enter should select the first suggestion, never submit the page.
            if (event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()

              if (results[0]) {
                pick(results[0])
              }
            }

            if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder={placeholder}
          aria-label="Search map places"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-busy={busy}
          autoComplete="off"
          spellCheck={false}
        />

        {busy && (
          <span
            className="placeSearchSpinner livePlaceSearchSpinner"
            aria-label="Finding places"
          />
        )}

        {!busy && query && (
          <button
            type="button"
            className="livePlaceSearchClear"
            aria-label="Clear place search"
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              requestIdRef.current += 1
              abortRef.current?.abort()
              setQuery('')
              setResults([])
              setOpen(false)
              setMessage(null)
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          className="placeResults livePlaceResults"
          role="listbox"
          aria-label="Matching map places"
        >
          {results.map(place => (
            <li key={place.id} role="option" aria-selected="false">
              <button
                type="button"
                onMouseDown={event => {
                  // Pick before the input loses focus.
                  event.preventDefault()
                }}
                onClick={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  pick(place)
                }}
              >
                <span className="livePlacePin" aria-hidden="true">
                  {place.source === 'awasar' ? 'A' : '●'}
                </span>

                <span className="livePlaceCopy">
                  <span className="placeResultTitle">
                    <strong>{place.name}</strong>
                    {place.source === 'awasar' && <em>On Awasar</em>}
                  </span>

                  {place.address && <span>{place.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p className="placeSearchStatus muted" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  )
}
