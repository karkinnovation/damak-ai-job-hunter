'use client'

import { useEffect, useRef, useState } from 'react'

export type PlaceResult = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}

/*
 * Address search used when someone is setting their home or business
 * location. It calls /api/geocode, which does the actual lookup server-side
 * (see that route for why it can't run in the browser).
 *
 * Debounced so typing "Damak Bazaar" fires one request instead of eleven —
 * this matters both for Nominatim's rate limits and for anyone on mobile data.
 */
export function PlaceSearch({
  onPick,
  placeholder = 'Search your address or a nearby landmark',
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
  const pickedRef = useRef(false)

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    const q = query.trim()

    // Don't re-search the text we just inserted after a pick.
    if (pickedRef.current) {
      pickedRef.current = false
      return
    }

    if (q.length < 3) {
      setResults([])
      setStatus(null)
      setBusy(false)
      return
    }

    const timer = setTimeout(async () => {
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

        if (!res.ok) {
          setResults([])
          setStatus(data?.error || 'Place search is temporarily unavailable.')
        } else if (!data.results?.length) {
          setResults([])
          setStatus(`Nothing found for “${q}”. Try a landmark, ward or business name — or just tap the map below.`)
        } else {
          setResults(data.results)
          setOpen(true)
        }
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          setResults([])
          setStatus('Could not reach place search. You can still set the pin on the map below.')
        }
      } finally {
        setBusy(false)
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [query])

  function pick(place: PlaceResult) {
    pickedRef.current = true
    setQuery(place.name)
    setResults([])
    setOpen(false)
    setStatus(null)
    onPick(place)
  }

  return (
    <div className="placeSearch" ref={boxRef}>
      <div className="placeSearchField">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          aria-label="Search for an address or place"
          autoComplete="off"
        />
        {busy && <span className="placeSearchSpinner" aria-hidden="true" />}
      </div>

      {open && results.length > 0 && (
        <ul className="placeResults">
          {results.map(place => (
            <li key={place.id}>
              <button type="button" onClick={() => pick(place)}>
                <strong>{place.name}</strong>
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
