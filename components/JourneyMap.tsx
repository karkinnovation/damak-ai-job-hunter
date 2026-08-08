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
      if (window.L) resolve(window.L)
      else {
        existing.addEventListener('load', () => resolve(window.L), { once: true })
        existing.addEventListener('error', () => reject(new Error('Could not load Leaflet')), { once: true })
      }
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

function pin(L: any, label: string, kind: 'home' | 'work') {
  return L.divIcon({
    className: 'awasarMapMarkerWrap',
    html: `<div class="awasarMapMarker ${kind}"><span>${label}</span></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 38],
  })
}

function travellerIcon(L: any) {
  return L.divIcon({
    className: 'awasarTravellerWrap',
    html: '<div class="awasarTraveller"><i></i></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function streetViewUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`
}

function osmUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
}

function safeTooltipContent(text: string) {
  const content = document.createElement('span')
  content.textContent = text
  return content
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

  const [error, setError] = useState<string | null>(null)
  const [progressKm, setProgressKm] = useState(0)

  const totalKm = haversineKm(home.latitude, home.longitude, work.latitude, work.longitude)

  const runAnimation = useCallback(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const from: [number, number] = [home.latitude, home.longitude]
    const to: [number, number] = [work.latitude, work.longitude]
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      trailRef.current?.setLatLngs([from, to])
      travellerRef.current?.setLatLng(to)
      setProgressKm(totalKm)
      return
    }

    // Short enough to feel responsive, long enough to communicate the route.
    const duration = 900
    const start = performance.now()

    const step = (now: number) => {
      const raw = Math.min(1, (now - start) / duration)
      const t = 1 - Math.pow(1 - raw, 3)
      const lat = from[0] + (to[0] - from[0]) * t
      const lng = from[1] + (to[1] - from[1]) * t

      trailRef.current?.setLatLngs([from, [lat, lng]])
      travellerRef.current?.setLatLng([lat, lng])
      setProgressKm(totalKm * t)

      if (raw < 1) rafRef.current = requestAnimationFrame(step)
      else rafRef.current = null
    }

    rafRef.current = requestAnimationFrame(step)
  }, [home.latitude, home.longitude, work.latitude, work.longitude, totalKm])

  useEffect(() => {
    let cancelled = false

    loadLeaflet()
      .then((L: any) => {
        if (cancelled || mapRef.current) return

        const from: [number, number] = [home.latitude, home.longitude]
        const to: [number, number] = [work.latitude, work.longitude]

        // This is intentionally a view-only route preview: no address/business
        // search box appears after the seeker clicks Apply.
        const map = L.map(`awasar-journey-${id}`, {
          scrollWheelZoom: false,
          preferCanvas: true,
          zoomControl: true,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)

        L.polyline([from, to], {
          color: '#22297A',
          weight: 2,
          opacity: 0.18,
          dashArray: '4 8',
        }).addTo(map)

        trailRef.current = L.polyline([from, from], {
          color: '#22297A',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
        }).addTo(map)

        const homeMarker = L.marker(from, { icon: pin(L, 'H', 'home') }).addTo(map)
        const workMarker = L.marker(to, { icon: pin(L, 'W', 'work') }).addTo(map)

        homeMarker.bindTooltip(safeTooltipContent('Your home'), {
          permanent: true,
          direction: 'top',
          offset: [0, -30],
          className: 'awasarMapLabel',
        })

        workMarker.bindTooltip(safeTooltipContent(workLabel), {
          permanent: true,
          direction: 'top',
          offset: [0, -30],
          className: 'awasarMapLabel awasarBusinessLabel',
        })

        travellerRef.current = L.marker(from, {
          icon: travellerIcon(L),
          interactive: false,
          zIndexOffset: 900,
        }).addTo(map)

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

        map.fitBounds([from, to], { padding: [58, 58], maxZoom: 16 })
        mapRef.current = map
        requestAnimationFrame(() => map.invalidateSize())
        window.setTimeout(runAnimation, 120)
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
      <div
        id={`awasar-journey-${id}`}
        className="leafletMap journeyCanvas"
        aria-label={`Route from your home to ${workLabel}`}
      />

      <div className="journeyReadout">
        <div className="journeyBar" aria-hidden="true">
          <span style={{ width: `${totalKm ? (progressKm / totalKm) * 100 : 0}%` }} />
        </div>
        <p className="journeyDistance">
          <strong>{progressKm.toFixed(1)} km</strong> from your home
        </p>
      </div>

      <div className="mapRouteActions">
        <a
          className="button secondary small"
          href={osmUrl(work.latitude, work.longitude)}
          target="_blank"
          rel="noreferrer"
        >
          Open workplace map ↗
        </a>
        <a
          className="button secondary small"
          href={streetViewUrl(work.latitude, work.longitude)}
          target="_blank"
          rel="noreferrer"
        >
          Street view ↗
        </a>
      </div>

      <p className="streetViewHint muted">
        Street view opens in Google Maps if imagery is available for this location. Awasar does not use a paid Google Maps API.
      </p>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
