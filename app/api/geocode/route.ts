import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/*
 * Free place search for profile map pickers.
 *
 * 1) Search Awasar's own registered businesses first. This guarantees that a
 *    business already using Awasar can be found by name even if OpenStreetMap
 *    does not contain that business yet.
 * 2) Fall back to OpenStreetMap/Nominatim for landmarks and addresses.
 * 3) Nominatim is called only after an explicit user search (no autocomplete).
 */

export const runtime = 'nodejs'
export const preferredRegion = 'auto'

type Place = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  source: 'awasar' | 'osm'
}

let lastNominatimRequestAt = 0
let nominatimQueue: Promise<void> = Promise.resolve()

function cleanQuery(value: string) {
  return value.replace(/[%,]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function searchAwasarBusinesses(query: string): Promise<Place[]> {
  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    if (!claimsData?.claims?.sub) return []

    const safe = cleanQuery(query)
    const { data, error } = await supabase
      .from('businesses')
      .select('id,business_name,ward,city,latitude,longitude')
      .ilike('business_name', `%${safe}%`)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(5)

    if (error) return []

    return (data || []).map((business: any) => ({
      id: `awasar-${business.id}`,
      name: business.business_name,
      address: `${business.city || 'Damak'}-${business.ward}, Jhapa`,
      latitude: Number(business.latitude),
      longitude: Number(business.longitude),
      source: 'awasar' as const,
    })).filter((place: Place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
  } catch {
    return []
  }
}

async function waitForNominatimSlot() {
  const previous = nominatimQueue
  let release!: () => void
  nominatimQueue = new Promise<void>(resolve => { release = resolve })
  await previous

  const wait = Math.max(0, 1050 - (Date.now() - lastNominatimRequestAt))
  if (wait) await new Promise(resolve => setTimeout(resolve, wait))
  lastNominatimRequestAt = Date.now()
  release()
}

async function searchNominatim(query: string): Promise<Place[]> {
  await waitForNominatimSlot()

  const q = /damak|jhapa|nepal/i.test(query)
    ? query
    : `${query}, Damak, Jhapa, Nepal`

  const url =
    'https://nominatim.openstreetmap.org/search' +
    '?format=jsonv2&limit=6&addressdetails=1&countrycodes=np&bounded=0' +
    '&viewbox=87.35,26.95,88.25,26.25' +
    `&q=${encodeURIComponent(q)}`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Awasar/1.0 (hyperlocal job matching for Damak, Jhapa, Nepal)',
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
    next: { revalidate: 86400 },
  })

  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const data = await res.json()

  return (data || []).map((item: any) => {
    const full: string = item.display_name || ''
    const parts = full.split(',').map((s: string) => s.trim())
    return {
      id: `osm-${item.osm_type || 'place'}-${item.osm_id || item.place_id}`,
      name: item.name || parts[0] || 'Unnamed place',
      address: parts.slice(1, 5).join(', '),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      source: 'osm' as const,
    }
  }).filter((p: Place) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
}

function dedupePlaces(places: Place[]) {
  const seen = new Set<string>()
  return places.filter(place => {
    const key = `${place.name.toLowerCase()}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function GET(request: Request) {
  const query = cleanQuery(new URL(request.url).searchParams.get('q') || '')

  if (query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const local = await searchAwasarBusinesses(query)

    // Registered Awasar businesses are authoritative for our own employer pins
    // and return immediately. Only use the public OSM service when Awasar has
    // no matching business, which keeps search faster and reduces API traffic.
    let osm: Place[] = []
    if (local.length === 0) {
      try {
        osm = await searchNominatim(query)
      } catch {
        // The user can still drop a pin directly on the map.
      }
    }

    const results = dedupePlaces([...local, ...osm]).slice(0, 8)

    return NextResponse.json(
      { results, provider: local.length ? 'awasar+osm' : 'osm' },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    )
  } catch {
    return NextResponse.json(
      { results: [], error: 'Place search is temporarily unavailable. You can still select the pin directly on the map.' },
      { status: 503 }
    )
  }
}
