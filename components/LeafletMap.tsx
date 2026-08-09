'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { PlaceSearch, type PlaceResult } from '@/components/PlaceSearch'

declare global {
  interface Window { L?: any; __awasarLeafletPromise?: Promise<any> }
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_CSS_INTEGRITY = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
const LEAFLET_JS_INTEGRITY = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
const NEPAL_CENTER: [number, number] = [28.3949, 84.1240]

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

function pinIcon(L: any, label: string, kind: 'home' | 'work' = 'home') {
  return L.divIcon({
    className: 'awasarMapMarkerWrap',
    html: `<div class="awasarMapMarker ${kind}"><span>${label}</span></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 38],
  })
}

function streetViewUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`
}

function osmUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
}

function bindPermanentLabel(marker: any, text: string) {
  marker.unbindTooltip?.()
  const content = document.createElement('span')
  content.textContent = text
  marker.bindTooltip(content, {
    permanent: true,
    direction: 'top',
    offset: [0, -30],
    className: 'awasarMapLabel',
    opacity: 0.96,
  })
}

export function LocationPicker({
  latitude,
  longitude,
  label = 'Your location',
  liveLabelInputName,
}: {
  latitude?: number | null
  longitude?: number | null
  label?: string
  liveLabelInputName?: string
}) {
  const id = useId().replace(/:/g, '')
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [lat, setLat] = useState<number | null>(latitude ?? null)
  const [lng, setLng] = useState<number | null>(longitude ?? null)
  const [markerLabel, setMarkerLabel] = useState(label)
  const [status, setStatus] = useState('Start typing a place above, choose a suggestion, or tap the map to drop a pin.')

  const fillAdministrativeFields = useCallback((location: {
    city?: string
    district?: string
    province?: string
    ward?: number | null
  }) => {
    const values: Record<string, string | number | undefined | null> = {
      city: location.city,
      district: location.district,
      province: location.province,
      ward: location.ward,
    }

    for (const [name, value] of Object.entries(values)) {
      if (value == null || value === '') continue
      const field = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null
      if (!field) continue
      field.value = String(value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, [])

  useEffect(() => {
    if (!liveLabelInputName) return
    const input = document.querySelector(`input[name="${liveLabelInputName}"]`) as HTMLInputElement | null
    if (!input) return

    const update = () => {
      const value = input.value.trim()
      setMarkerLabel(value ? `${value} workplace` : label)
    }

    update()
    input.addEventListener('input', update)
    return () => input.removeEventListener('input', update)
  }, [label, liveLabelInputName])

  useEffect(() => {
    if (markerRef.current) bindPermanentLabel(markerRef.current, markerLabel)
  }, [markerLabel])

  const setPin = useCallback((nextLat: number, nextLng: number, zoom = 16) => {
    setLat(nextLat)
    setLng(nextLng)
    const L = window.L
    const map = mapRef.current
    if (!L || !map) return

    if (!markerRef.current) {
      markerRef.current = L.marker([nextLat, nextLng], {
        draggable: true,
        icon: pinIcon(L, '●', label.toLowerCase().includes('work') ? 'work' : 'home'),
      }).addTo(map)
      bindPermanentLabel(markerRef.current, markerLabel)
      markerRef.current.on('dragend', () => {
        const p = markerRef.current.getLatLng()
        setLat(Number(p.lat.toFixed(6)))
        setLng(Number(p.lng.toFixed(6)))
        setStatus('Pin moved. Drag it again to fine-tune.')
      })
    } else {
      markerRef.current.setLatLng([nextLat, nextLng])
      bindPermanentLabel(markerRef.current, markerLabel)
    }

    map.setView([nextLat, nextLng], zoom, { animate: true })
  }, [label, markerLabel])

  function handlePick(place: PlaceResult) {
    setPin(Number(place.latitude.toFixed(6)), Number(place.longitude.toFixed(6)))
    fillAdministrativeFields(place)
    setStatus(`Pin set to ${place.name}. Location fields were filled when map data provided them; review them before saving.`)
  }

  useEffect(() => {
    let cancelled = false

    loadLeaflet().then((L) => {
      if (cancelled || mapRef.current) return
      const start: [number, number] = lat != null && lng != null ? [lat, lng] : NEPAL_CENTER
      const map = L.map(`awasar-map-${id}`, {
        scrollWheelZoom: false,
        zoomControl: true,
        preferCanvas: true,
      }).setView(start, lat != null ? 15 : 7)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      mapRef.current = map

      const placeMarker = (nextLat: number, nextLng: number) => {
        if (!markerRef.current) {
          const marker = L.marker([nextLat, nextLng], {
            draggable: true,
            icon: pinIcon(L, '●', label.toLowerCase().includes('work') ? 'work' : 'home'),
          }).addTo(map)

          bindPermanentLabel(marker, markerLabel)

          marker.on('dragend', () => {
            const p = marker.getLatLng()
            setLat(Number(p.lat.toFixed(6)))
            setLng(Number(p.lng.toFixed(6)))
            setStatus('Location selected. Drag the pin to adjust it.')
          })

          markerRef.current = marker
        } else {
          markerRef.current.setLatLng([nextLat, nextLng])
          bindPermanentLabel(markerRef.current, markerLabel)
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

      requestAnimationFrame(() => map.invalidateSize())
    }).catch(() => setStatus('Map could not load. Check your internet connection and try again.'))

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
    // Leaflet owns live marker state after initialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, label])

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus('Location access is not supported by this browser.')
      return
    }

    setStatus('Getting your current location…')
    navigator.geolocation.getCurrentPosition(
      async position => {
        const nextLat = Number(position.coords.latitude.toFixed(6))
        const nextLng = Number(position.coords.longitude.toFixed(6))
        setPin(nextLat, nextLng)
        setStatus('Current location selected. Identifying city, district and province…')

        try {
          const res = await fetch(`/api/reverse-geocode?lat=${nextLat}&lon=${nextLng}`)
          const data = await res.json()
          if (res.ok) {
            fillAdministrativeFields(data)
            setStatus('Current location selected. Location fields were filled automatically; review them before saving.')
          } else {
            setStatus('Current location selected. Please fill city, district and province manually.')
          }
        } catch {
          setStatus('Current location selected. Please fill city, district and province manually.')
        }
      },
      () => setStatus('Could not access your location. Please choose it manually on the map.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  return (
    <div className="mapPicker">
      <div className="mapPickerHead">
        <div>
          <strong>{label}</strong>
          <span className="mapPickerHint">Start typing to see live places, then fine-tune the exact pin on the map.</span>
        </div>
        <button className="button secondary small" type="button" onClick={useCurrentLocation}>
          Use current location
        </button>
      </div>

      <PlaceSearch onPick={handlePick} />

      <div id={`awasar-map-${id}`} className="leafletMap" aria-label={`${label} map picker`} />
      <input type="hidden" name="latitude" value={lat ?? ''} />
      <input type="hidden" name="longitude" value={lng ?? ''} />

      <div className="mapPickerStatus">
        <span>{status}</span>
        {lat != null && lng != null && <span className="coordinateStatus">Pin set</span>}
      </div>

      {lat != null && lng != null && (
        <div className="mapExternalActions">
          <a className="mapTextLink" href={osmUrl(lat, lng)} target="_blank" rel="noreferrer">
            Open full map ↗
          </a>
          <a className="mapTextLink" href={streetViewUrl(lat, lng)} target="_blank" rel="noreferrer">
            Street view ↗
          </a>
        </div>
      )}

      <p className="mapPrivacyNote muted">
        Only coordinates are stored. Anonymous employer browsing never receives your exact location.
      </p>
    </div>
  )
}

export function DistanceMap({
  home,
  work,
  workLabel = 'Workplace',
}: {
  home: { latitude: number; longitude: number }
  work: { latitude: number; longitude: number }
  workLabel?: string
}) {
  const id = useId().replace(/:/g, '')
  const mapRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    loadLeaflet().then((L) => {
      if (cancelled || mapRef.current) return
      const homePoint: [number, number] = [home.latitude, home.longitude]
      const workPoint: [number, number] = [work.latitude, work.longitude]
      const map = L.map(`awasar-distance-${id}`, { scrollWheelZoom: false, preferCanvas: true })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      const homeMarker = L.marker(homePoint, { icon: pinIcon(L, 'H', 'home') }).addTo(map)
      const workMarker = L.marker(workPoint, { icon: pinIcon(L, 'W', 'work') }).addTo(map)
      bindPermanentLabel(homeMarker, 'Home')
      bindPermanentLabel(workMarker, workLabel)

      L.polyline([homePoint, workPoint], { color: '#3157d5', weight: 4, dashArray: '8 8' }).addTo(map)
      map.fitBounds([homePoint, workPoint], { padding: [42, 42], maxZoom: 16 })
      mapRef.current = map
      requestAnimationFrame(() => map.invalidateSize())
    })

    return () => {
      cancelled = true
      if (mapRef.current) mapRef.current.remove()
      mapRef.current = null
    }
  }, [home.latitude, home.longitude, id, work.latitude, work.longitude, workLabel])

  return (
    <div>
      <div id={`awasar-distance-${id}`} className="leafletMap distancePreviewMap" aria-label={`Map showing home and ${workLabel}`} />
      <div className="mapExternalActions">
        <a className="mapTextLink" href={osmUrl(work.latitude, work.longitude)} target="_blank" rel="noreferrer">Open workplace map ↗</a>
        <a className="mapTextLink" href={streetViewUrl(work.latitude, work.longitude)} target="_blank" rel="noreferrer">Street view ↗</a>
      </div>
    </div>
  )
}
