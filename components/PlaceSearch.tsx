'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

export type PlaceResult = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  source?: 'awasar' | 'osm'
}

type CachedSearch = {
  savedAt: number
  results: PlaceResult[]
}

const CACHE_TTL = 24 * 60 * 60 * 1000

/*
 * Deliberately uses an explicit Search button instead of autocomplete.
 * This makes the UI predictable on slow mobile connections and avoids
 * hammering the public OpenStreetMap/Nominatim service while somebody types.
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
        JSON.stringify({ savedAt: Date.now(), results: next } satisfies CachedSearch)
      )
    } catch {
      // Storage can be unavailable in private browsing. Search still works.
    }
  }

  async function search(e?: FormEvent) {
    e?.preventDefault()
    const q = query.trim()

    if (q.length < 2) {
      setResults([])
      setOpen(false)
      setStatus('Type at least 2 characters, for example “Damak Chowk” or a business name.')
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
    setStatus(null)

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
      const data = await res.json()
      const next = (data.results || []) as PlaceResult[]

      if (!res.ok) {
        setResults([])
        setOpen(false)
        setStatus(data?.error || 'Place search is temporarily unavailable. You can still tap the map.')
      } else if (!next.length) {
        setResults([])
        setOpen(false)
        setStatus(`Nothing found for “${q}”. Try the business name plus “Damak”, a landmark, or tap the map.`)
      } else {
        setResults(next)
        setOpen(true)
        setStatus(null)
        writeCache(q, next)
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setResults([])
        setOpen(false)
        setStatus('Could not reach place search. You can still drop the pin directly on the map.')
      }
    } finally {
      setBusy(false)
    }
  }

  function pick(place: PlaceResult) {
    setQuery(place.name)
    setResults([])
    setOpen(false)
    setStatus(null)
    onPick(place)
  }

  return (
    <div className="placeSearch" ref={boxRef}>
      <form className="placeSearchField" onSubmit={search}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          aria-label="Search for an address, landmark or business"
          autoComplete="off"
        />
        <button type="submit" className="placeSearchButton" disabled={busy}>
          {busy ? <span className="placeSearchSpinner" aria-hidden="true" /> : 'Search'}
        </button>
      </form>

      {open && results.length > 0 && (
        <ul className="placeResults">
          {results.map(place => (
            <li key={place.id}>
              <button type="button" onClick={() => pick(place)}>
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

      {status && <p className="placeSearchStatus muted">{status}</p>}
    </div>
  )
}
