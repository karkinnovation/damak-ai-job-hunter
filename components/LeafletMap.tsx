'use client'

import { useEffect, useId, useRef, useState } from 'react'

declare global {
  interface Window { L?: any; __awasarLeafletPromise?: Promise<any> }
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_CSS_INTEGRITY = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
const LEAFLET_JS_INTEGRITY = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
const DAMAK_CENTER: [number, number] = [26.66, 87.70]

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

function pinIcon(L: any, label: string, kind: 'home' | 'work' = 'home') {
  return L.divIcon({
    className: 'awasarMapMarkerWrap',
    html: `<div class="awasarMapMarker ${kind}"><span>${label}</span></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 38],
  })
}

export function LocationPicker({
  latitude,
  longitude,
  label = 'Your location',
}: {
  latitude?: number | null
  longitude?: number | null
  label?: string
}) {
  const id = useId().replace(/:/g, '')
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [lat, setLat] = useState<number | null>(latitude ?? null)
  const [lng, setLng] = useState<number | null>(longitude ?? null)
  const [status, setStatus] = useState('Tap the map or drag the pin to choose the location.')

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || mapRef.current) return
      const start: [number, number] = lat != null && lng != null ? [lat, lng] : DAMAK_CENTER
      const map = L.map(`awasar-map-${id}`, { scrollWheelZoom: false }).setView(start, lat != null ? 15 : 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      mapRef.current = map

      const placeMarker = (nextLat: number, nextLng: number) => {
        if (!markerRef.current) {
          const marker = L.marker([nextLat, nextLng], {
            draggable: true,
            icon: pinIcon(L, '●', 'home'),
          }).addTo(map)
          marker.on('dragend', () => {
            const p = marker.getLatLng()
            setLat(Number(p.lat.toFixed(6)))
            setLng(Number(p.lng.toFixed(6)))
            setStatus('Location selected. Drag the pin to adjust it.')
          })
          markerRef.current = marker
        } else {
          markerRef.current.setLatLng([nextLat, nextLng])
        }
      }

      if (lat != null && lng != null) placeMarker(lat, lng)

      map.on('click', (e: any) => {
        const nextLat = Number(e.latlng.lat.toFixed(6))
        const nextLng = Number(e.latlng.lng.toFixed(6))
        setLat(nextLat)
        setLng(nextLng)
        placeMarker(nextLat, nextLng)
        setStatus('Location selected. Drag the pin to adjust it.')
      })

      setTimeout(() => map.invalidateSize(), 0)
    }).catch(() => setStatus('Map could not load. Check your internet connection and try again.'))

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
    // Deliberately initialize once; marker state is handled by Leaflet itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus('Location access is not supported by this browser.')
      return
    }
    setStatus('Getting your current location…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = Number(position.coords.latitude.toFixed(6))
        const nextLng = Number(position.coords.longitude.toFixed(6))
        setLat(nextLat)
        setLng(nextLng)
        const L = window.L
        const map = mapRef.current
        if (L && map) {
          if (!markerRef.current) {
            markerRef.current = L.marker([nextLat, nextLng], { draggable: true, icon: pinIcon(L, '●', 'home') }).addTo(map)
            markerRef.current.on('dragend', () => {
              const p = markerRef.current.getLatLng()
              setLat(Number(p.lat.toFixed(6)))
              setLng(Number(p.lng.toFixed(6)))
            })
          } else markerRef.current.setLatLng([nextLat, nextLng])
          map.setView([nextLat, nextLng], 16)
        }
        setStatus('Current location selected. You can drag the pin to fine-tune it.')
      },
      () => setStatus('Could not access your location. Please choose it manually on the map.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="mapPicker">
      <div className="mapPickerHead">
        <div>
          <strong>{label}</strong>
          <p className="muted">Only coordinates are stored. Anonymous employer browsing never receives your exact coordinates.</p>
        </div>
        <button className="button secondary small" type="button" onClick={useCurrentLocation}>Use current location</button>
      </div>
      <div id={`awasar-map-${id}`} className="leafletMap" aria-label={`${label} map picker`} />
      <input type="hidden" name="latitude" value={lat ?? ''} />
      <input type="hidden" name="longitude" value={lng ?? ''} />
      <div className="mapPickerStatus">
        <span>{status}</span>
        {lat != null && lng != null && <span className="coordinateStatus">✓ Pin saved</span>}
      </div>
    </div>
  )
}

export function DistanceMap({
  home,
  work,
}: {
  home: { latitude: number; longitude: number }
  work: { latitude: number; longitude: number }
}) {
  const id = useId().replace(/:/g, '')
  const mapRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || mapRef.current) return
      const homePoint: [number, number] = [home.latitude, home.longitude]
      const workPoint: [number, number] = [work.latitude, work.longitude]
      const map = L.map(`awasar-distance-${id}`, { scrollWheelZoom: false, dragging: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      L.marker(homePoint, { icon: pinIcon(L, 'H', 'home') }).addTo(map).bindTooltip('Home')
      L.marker(workPoint, { icon: pinIcon(L, 'W', 'work') }).addTo(map).bindTooltip('Workplace')
      L.polyline([homePoint, workPoint], { color: '#3157d5', weight: 4, dashArray: '8 8' }).addTo(map)
      map.fitBounds([homePoint, workPoint], { padding: [42, 42], maxZoom: 16 })
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 0)
    })

    return () => {
      cancelled = true
      if (mapRef.current) mapRef.current.remove()
      mapRef.current = null
    }
  }, [home.latitude, home.longitude, id, work.latitude, work.longitude])

  return <div id={`awasar-distance-${id}`} className="leafletMap distancePreviewMap" aria-label="Map showing home and workplace" />
}
