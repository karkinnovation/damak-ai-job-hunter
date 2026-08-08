'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

declare global {
  interface Window { L?: any; __awasarLeafletPromise?: Promise<any> }
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_CSS_INTEGRITY = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
const LEAFLET_JS_INTEGRITY = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='

function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Leaflet requires a browser'))
  if (window.L) return Promise.resolve(window.L)
  if (window.__awasarLeafletPromise) return window.__awasarLeafletPromise

  window.__awasarLeafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      link.integrity = LEAFLET_CSS_INTEGRITY
      link.crossOrigin = ''
      document.head.appendChild(link)
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L))
      existing.addEventListener('error', () => reject(new Error('Could not load Leaflet')))
      return
    }
    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.integrity = LEAFLET_JS_INTEGRITY
    script.crossOrigin = ''
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = () => reject(new Error('Could not load Leaflet'))
    document.head.appendChild(script)
  })

  return window.__awasarLeafletPromise
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function pin(L: any, label: string, kind: 'home' | 'work' | 'search') {
  return L.divIcon({
    className: 'awasarMapMarkerWrap',
    html: `<div class="awasarMapMarker ${kind}"><span>${label}</span></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 38],
  })
}

// The dot that travels along the route.
function travellerIcon(L: any) {
  return L.divIcon({
    className: 'awasarTravellerWrap',
    html: '<div class="awasarTraveller"><i></i></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

type Point = { latitude: number; longitude: number }

export function JourneyMap({
  home,
  work,
  workLabel = 'Workplace',
  maxTravelKm,
}: {
  home: Point
  work: Point
  workLabel?: string
  maxTravelKm?: number | null
}) {
  const id = useId().replace(/:/g, '')
  const mapRef = useRef<any>(null)
  const trailRef = useRef<any>(null)
  const travellerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const searchMarkerRef = useRef<any>(null)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressKm, setProgressKm] = useState(0)
  const [playing, setPlaying] = useState(false)

  const totalKm = haversineKm(home.latitude, home.longitude, work.latitude, work.longitude)

  // --- the reveal animation -------------------------------------------------
  const runAnimation = useCallback(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const from: [number, number] = [home.latitude, home.longitude]
    const to: [number, number] = [work.latitude, work.longitude]

    // Respect the OS-level reduced-motion setting: draw the finished route
    // immediately instead of animating it.
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      trailRef.current?.setLatLngs([from, to])
      travellerRef.current?.setLatLng(to)
      setProgressKm(totalKm)
      setPlaying(false)
      return
    }

    setPlaying(true)
    const duration = 2200
    const start = performance.now()

    const step = (now: number) => {
      const raw = Math.min(1, (now - start) / duration)
      // ease-out so the marker decelerates into the workplace
      const t = 1 - Math.pow(1 - raw, 3)

      const lat = from[0] + (to[0] - from[0]) * t
      const lng = from[1] + (to[1] - from[1]) * t

      trailRef.current?.setLatLngs([from, [lat, lng]])
      travellerRef.current?.setLatLng([lat, lng])
      setProgressKm(totalKm * t)

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
        setPlaying(false)
      }
    }

    rafRef.current = requestAnimationFrame(step)
  }, [home.latitude, home.longitude, work.latitude, work.longitude, totalKm])

  // --- map setup ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    loadLeaflet()
      .then((L: any) => {
        if (cancelled || mapRef.current) return

        const from: [number, number] = [home.latitude, home.longitude]
        const to: [number, number] = [work.latitude, work.longitude]

        const map = L.map(`awasar-journey-${id}`, { scrollWheelZoom: false })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)

        // A faint full-route line so the destination reads as reachable even
        // before the animated trail gets there.
        L.polyline([from, to], { color: '#22297A', weight: 2, opacity: 0.18, dashArray: '4 8' }).addTo(map)

        trailRef.current = L.polyline([from, from], {
          color: '#22297A',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
        }).addTo(map)

        L.marker(from, { icon: pin(L, 'H', 'home') }).addTo(map).bindTooltip('Your home')
        L.marker(to, { icon: pin(L, 'W', 'work') }).addTo(map).bindTooltip(workLabel)

        travellerRef.current = L.marker(from, {
          icon: travellerIcon(L),
          interactive: false,
          zIndexOffset: 900,
        }).addTo(map)

        // Travel-radius ring, so "within your preferred distance" is visible
        // rather than only stated in text.
        if (maxTravelKm) {
          L.circle(from, {
            radius: Number(maxTravelKm) * 1000,
            color: '#0E7A4F',
            weight: 1.5,
            fillColor: '#0E7A4F',
            fillOpacity: 0.05,
            dashArray: '5 6',
          }).addTo(map)
        }

        map.fitBounds([from, to], { padding: [48, 48], maxZoom: 16 })
        mapRef.current = map
        setTimeout(() => map.invalidateSize(), 0)
        setReady(true)
        setTimeout(runAnimation, 350)
      })
      .catch(() => setError('Map could not load. Check your internet connection.'))

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (mapRef.current) mapRef.current.remove()
      mapRef.current = null
      trailRef.current = null
      travellerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className="journeyMap">
      <JourneySearch mapRef={mapRef} searchMarkerRef={searchMarkerRef} disabled={!ready} />

      <div id={`awasar-journey-${id}`} className="leafletMap journeyCanvas" aria-label={`Route from your home to ${workLabel}`} />

      <div className="journeyReadout">
        <div className="journeyProgress">
          <div className="journeyBar">
            <span style={{ width: `${totalKm ? (progressKm / totalKm) * 100 : 0}%` }} />
          </div>
          <strong>{progressKm.toFixed(1)} km</strong>
          <span className="muted">of {totalKm.toFixed(1)} km</span>
        </div>
        <button className="button secondary small" type="button" onClick={runAnimation} disabled={!ready || playing}>
          {playing ? 'Playing…' : 'Replay route'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  )
}

/*
 * Search box layered over the map.
 *
 * Uses Nominatim (the same OpenStreetMap project already supplying the tiles),
 * biased to a bounding box around Jhapa so a search for "Damak" returns the
 * local place rather than a same-named town elsewhere. Results only move the
 * map view and drop a temporary marker — searching never edits a saved home
 * or workplace pin.
 */
function JourneySearch({
  mapRef,
  searchMarkerRef,
  disabled,
}: {
  mapRef: React.MutableRefObject<any>
  searchMarkerRef: React.MutableRefObject<any>
  disabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    setBusy(true)
    setStatus(null)
    setResults([])

    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=np' +
        '&viewbox=87.40,26.90,88.20,26.30&bounded=0&q=' +
        encodeURIComponent(q)

      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error('search failed')

      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) {
        setStatus(`No places found for “${q}”. Try a landmark, ward or town name.`)
      } else {
        setResults(data)
      }
    } catch {
      setStatus('Place search is unavailable right now. You can still pan and zoom the map.')
    } finally {
      setBusy(false)
    }
  }

  function goTo(item: any) {
    const L = window.L
    const map = mapRef.current
    if (!L || !map) return

    const lat = Number(item.lat)
    const lng = Number(item.lon)

    if (searchMarkerRef.current) {
      searchMarkerRef.current.setLatLng([lat, lng])
    } else {
      searchMarkerRef.current = L.marker([lat, lng], { icon: pin(L, '★', 'search') }).addTo(map)
    }
    searchMarkerRef.current.bindTooltip(item.display_name.split(',')[0]).openTooltip()

    map.setView([lat, lng], 15)
    setResults([])
    setQuery(item.display_name.split(',')[0])
  }

  function clear() {
    const map = mapRef.current
    if (searchMarkerRef.current && map) {
      map.removeLayer(searchMarkerRef.current)
      searchMarkerRef.current = null
    }
    setQuery('')
    setResults([])
    setStatus(null)
  }

  return (
    <div className="journeySearch">
      <form onSubmit={search} className="journeySearchBar">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search a place on the map — e.g. Damak Bazaar"
          aria-label="Search for a place on the map"
          disabled={disabled}
        />
        <button className="button small" type="submit" disabled={disabled || busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
        {(query || results.length > 0) && (
          <button className="button secondary small" type="button" onClick={clear}>Clear</button>
        )}
      </form>

      {results.length > 0 && (
        <ul className="journeyResults">
          {results.map(item => (
            <li key={item.place_id}>
              <button type="button" onClick={() => goTo(item)}>
                <strong>{item.display_name.split(',')[0]}</strong>
                <span>{item.display_name.split(',').slice(1, 3).join(',').trim()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {status && <p className="journeySearchStatus muted">{status}</p>}
    </div>
  )
}
